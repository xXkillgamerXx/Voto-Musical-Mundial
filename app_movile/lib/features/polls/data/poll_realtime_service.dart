import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../../core/api/api_config.dart';

typedef PollRealtimeMapHandler = void Function(Map<String, dynamic> event);

/// Socket.IO client for a single poll room (mirrors web `subscribePollRealtime`).
class PollRealtimeService {
  io.Socket? _socket;
  String? _pollId;
  void Function(dynamic)? _onConnect;
  PollRealtimeMapHandler? _onVoteDelta;
  PollRealtimeMapHandler? _onResultsDirty;
  PollRealtimeMapHandler? _onPollStateChanged;

  bool get isConnected => _socket?.connected == true;
  String? get pollId => _pollId;

  void subscribe({
    required String pollId,
    PollRealtimeMapHandler? onVoteDelta,
    PollRealtimeMapHandler? onResultsDirty,
    PollRealtimeMapHandler? onPollStateChanged,
  }) {
    final normalized = pollId.trim();
    if (normalized.isEmpty) return;

    if (_pollId == normalized && _socket != null) {
      _onVoteDelta = onVoteDelta;
      _onResultsDirty = onResultsDirty;
      _onPollStateChanged = onPollStateChanged;
      if (_socket!.connected) {
        _socket!.emit('join_poll', {'pollId': normalized});
      }
      return;
    }

    dispose();
    _pollId = normalized;
    _onVoteDelta = onVoteDelta;
    _onResultsDirty = onResultsDirty;
    _onPollStateChanged = onPollStateChanged;

    final socket = io.io(
      ApiConfig.uploadsOrigin,
      io.OptionBuilder()
          .setPath('/socket.io')
          .setTransports(['websocket', 'polling'])
          .disableAutoConnect()
          .enableForceNew()
          .enableReconnection()
          .setReconnectionAttempts(999999)
          .setReconnectionDelay(1000)
          .setReconnectionDelayMax(5000)
          .setTimeout(20000)
          .build(),
    );
    _socket = socket;

    void join() {
      final id = _pollId;
      if (id == null || id.isEmpty) return;
      socket.emit('join_poll', {'pollId': id});
    }

    _onConnect = (_) => join();

    socket
      ..onConnect(_onConnect!)
      ..onReconnect((_) => join())
      ..on('vote_delta', (raw) {
        final event = _asMap(raw);
        if (event == null) return;
        _onVoteDelta?.call(event);
      })
      ..on('results_dirty', (raw) {
        final event = _asMap(raw) ?? const <String, dynamic>{};
        _onResultsDirty?.call(event);
      })
      ..on('poll_state_changed', (raw) {
        final event = _asMap(raw);
        if (event == null) return;
        _onPollStateChanged?.call(event);
      });

    socket.connect();
  }

  void dispose() {
    final socket = _socket;
    final pollId = _pollId;
    final onConnect = _onConnect;

    if (socket != null) {
      if (onConnect != null) {
        socket.off('connect', onConnect);
      }
      socket.off('reconnect');
      socket.off('vote_delta');
      socket.off('results_dirty');
      socket.off('poll_state_changed');
      if (pollId != null && pollId.isNotEmpty) {
        socket.emit('leave_poll', {'pollId': pollId});
      }
      socket.dispose();
    }

    _socket = null;
    _pollId = null;
    _onConnect = null;
    _onVoteDelta = null;
    _onResultsDirty = null;
    _onPollStateChanged = null;
  }

  Map<String, dynamic>? _asMap(dynamic raw) {
    if (raw is Map<String, dynamic>) return raw;
    if (raw is Map) return Map<String, dynamic>.from(raw);
    return null;
  }
}
