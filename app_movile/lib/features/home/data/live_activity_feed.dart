import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../../core/api/api_config.dart';
import 'votes_api.dart';

class LiveActivityFeed extends ChangeNotifier {
  LiveActivityFeed(this._votesApi);

  static const _maxItems = 24;
  static const _displayWindow = Duration(minutes: 30);
  static const _bootstrapWindow = Duration(minutes: 2);
  static const _mergeWindow = Duration(seconds: 90);
  static const _syncInterval = Duration(seconds: 5);

  final VotesApi _votesApi;

  final List<VoteActivity> _activities = [];
  Set<String> _livePollIds = {};
  io.Socket? _socket;
  Timer? _syncTimer;
  Timer? _clockTimer;
  bool _connected = false;
  bool _started = false;

  List<VoteActivity> get activities => List.unmodifiable(_activities);
  bool get isConnected => _connected;

  int get activeFans =>
      _activities.map((vote) => vote.userId).where((id) => id.isNotEmpty).toSet().length;

  int get votesPerMinute {
    final now = DateTime.now();
    return _activities.where((vote) {
      final createdAt = vote.createdAt;
      return createdAt != null && now.difference(createdAt).inSeconds <= 60;
    }).length;
  }

  int get activePolls =>
      _activities.map((vote) => vote.pollId).where((id) => id.isNotEmpty).toSet().length;

  void start({required Iterable<String> livePollIds}) {
    _livePollIds = livePollIds.map((id) => id.trim()).where((id) => id.isNotEmpty).toSet();
    if (_started) {
      _pruneActivities();
      notifyListeners();
      return;
    }

    _started = true;
    _connectSocket();
    _syncTimer = Timer.periodic(_syncInterval, (_) => unawaited(_syncRecent()));
    _clockTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      _pruneActivities();
      notifyListeners();
    });
    unawaited(_syncRecent());
  }

  void updateLivePollIds(Iterable<String> livePollIds) {
    _livePollIds = livePollIds.map((id) => id.trim()).where((id) => id.isNotEmpty).toSet();
    _pruneActivities();
    notifyListeners();
  }

  @override
  void dispose() {
    _syncTimer?.cancel();
    _clockTimer?.cancel();
    _socket?.emit('leave_live_polls');
    _socket?.dispose();
    super.dispose();
  }

  void _connectSocket() {
    final origin = ApiConfig.uploadsOrigin;

    _socket = io.io(
      origin,
      io.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .enableAutoConnect()
          .enableReconnection()
          .setReconnectionAttempts(999)
          .setReconnectionDelay(1000)
          .setReconnectionDelayMax(5000)
          .setTimeout(20000)
          .build(),
    );

    _socket!
      ..onConnect((_) {
        _connected = true;
        _socket!.emit('join_live_polls');
        notifyListeners();
        unawaited(_syncRecent());
      })
      ..onDisconnect((_) {
        _connected = false;
        notifyListeners();
      })
      ..on('vote_delta', (data) {
        if (data is Map) {
          _pushVote(VoteActivity.fromRealtimePayload(Map<String, dynamic>.from(data)));
        }
      });
  }

  Future<void> _syncRecent() async {
    try {
      final rows = await _votesApi.getRecentActivity(limit: _maxItems, hours: 1);
      final incoming = rows
          .where(_acceptsVote)
          .where(_isBootstrapRecent)
          .toList(growable: false);
      var changed = false;

      for (final row in incoming) {
        if (_activities.any((vote) => vote.id == row.id)) {
          continue;
        }
        _activities.insert(0, row);
        changed = true;
      }

      if (_pruneActivities() || changed) {
        notifyListeners();
      }
    } catch (_) {
      // Keep current feed if sync fails.
    }
  }

  void _pushVote(VoteActivity vote) {
    if (!_acceptsVote(vote) || !_isRecentEnough(vote)) {
      return;
    }

    final mergeIndex = _activities.indexWhere(
      (entry) =>
          entry.userId == vote.userId &&
          entry.artistId == vote.artistId &&
          entry.pollId == vote.pollId &&
          entry.createdAt != null &&
          vote.createdAt != null &&
          vote.createdAt!.difference(entry.createdAt!).abs() <= _mergeWindow,
    );

    if (mergeIndex >= 0) {
      final existing = _activities[mergeIndex];
      _activities
        ..removeAt(mergeIndex)
        ..insert(
          0,
          existing.copyWith(
            createdAt: vote.createdAt ?? existing.createdAt,
            amount: (existing.amount + vote.amount).clamp(1, 5),
          ),
        );
    } else {
      _activities.insert(0, vote);
    }

    _pruneActivities();
    notifyListeners();
  }

  bool _acceptsVote(VoteActivity vote) {
    if (vote.userId.isEmpty) {
      return false;
    }

    if (_livePollIds.isNotEmpty && !_livePollIds.contains(vote.pollId)) {
      return false;
    }

    return true;
  }

  bool _isRecentEnough(VoteActivity vote) {
    final createdAt = vote.createdAt;
    if (createdAt == null) {
      return false;
    }

    return DateTime.now().difference(createdAt) <= _displayWindow;
  }

  bool _isBootstrapRecent(VoteActivity vote) {
    final createdAt = vote.createdAt;
    if (createdAt == null) {
      return false;
    }

    return DateTime.now().difference(createdAt) <= _bootstrapWindow;
  }

  bool _pruneActivities() {
    final cutoff = DateTime.now().subtract(_displayWindow);
    final before = _activities.length;
    _activities.removeWhere((vote) {
      if (!_acceptsVote(vote)) {
        return true;
      }

      final createdAt = vote.createdAt;
      return createdAt == null || createdAt.isBefore(cutoff);
    });

    if (_activities.length > _maxItems) {
      _activities.removeRange(_maxItems, _activities.length);
    }

    return _activities.length != before;
  }
}
