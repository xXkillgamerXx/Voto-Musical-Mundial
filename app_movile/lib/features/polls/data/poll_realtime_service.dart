import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../../core/api/api_config.dart';

class PollRealtimeService {
  io.Socket? _socket;
  String? _pollId;

  void subscribe({
    required String pollId,
    required void Function(Map<String, dynamic>) onVoteDelta,
    required void Function() onResultsDirty,
    required void Function(Map<String, dynamic>) onPollStateChanged,
  }) {
    dispose();
    _pollId = pollId;

    final socket = io.io(
      ApiConfig.uploadsOrigin,
      io.OptionBuilder()
          .setPath('/socket.io')
          .setTransports(['websocket', 'polling'])
          .enableAutoConnect()
          .enableReconnection()
          .setReconnectionAttempts(999)
          .setReconnectionDelay(1000)
          .setReconnectionDelayMax(5000)
          .build(),
    );
    _socket = socket;

    void join() => socket.emit('join_poll', {'pollId': pollId});

    socket
      ..onConnect((_) => join())
      ..on('vote_delta', (raw) {
        if (raw is Map) {
          onVoteDelta(Map<String, dynamic>.from(raw));
        }
      })
      ..on('results_dirty', (_) => onResultsDirty())
      ..on('poll_state_changed', (raw) {
        if (raw is Map) {
          onPollStateChanged(Map<String, dynamic>.from(raw));
        }
      });

    if (socket.connected) {
      join();
    }
  }

  void dispose() {
    final pollId = _pollId;
    if (pollId != null) {
      _socket?.emit('leave_poll', {'pollId': pollId});
    }
    _socket?.dispose();
    _socket = null;
    _pollId = null;
  }
}
