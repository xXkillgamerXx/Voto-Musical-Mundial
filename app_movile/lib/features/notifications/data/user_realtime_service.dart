import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:flutter/foundation.dart';

import '../../../core/api/api_config.dart';

typedef UserRealtimeHandler = void Function(Map<String, dynamic> event);

class UserRealtimeService {
  io.Socket? _socket;
  String? _userId;
  UserRealtimeHandler? _onUserEvent;

  void subscribe({
    required String userId,
    required String accessToken,
    required UserRealtimeHandler onUserEvent,
  }) {
    dispose();

    _userId = userId;
    _onUserEvent = onUserEvent;

    final origin = ApiConfig.uploadsOrigin;
    _socket = io.io(
      origin,
      io.OptionBuilder()
          .setPath('/socket.io')
          .setTransports(['websocket', 'polling'])
          .enableAutoConnect()
          .enableReconnection()
          .setReconnectionAttempts(999)
          .setReconnectionDelay(1000)
          .setReconnectionDelayMax(5000)
          .setTimeout(20000)
          .build(),
    );

    void joinUserRoom() {
      final socket = _socket;
      final id = _userId;
      if (socket == null || id == null || id.isEmpty) {
        return;
      }

      socket.emit('join_user', {
        'userId': id,
        'token': accessToken,
      });
    }

    _socket!
      ..onConnect((_) {
        debugPrint('[VMM-REALTIME] Socket conectado, join user $userId');
        joinUserRoom();
      })
      ..onDisconnect((_) {
        debugPrint('[VMM-REALTIME] Socket desconectado');
      })
      ..on('user_event', (raw) {
        if (raw is! Map) {
          return;
        }

        debugPrint('[VMM-REALTIME] user_event: $raw');
        _onUserEvent?.call(Map<String, dynamic>.from(raw));
      });

    joinUserRoom();
  }

  void dispose() {
    final socket = _socket;
    final userId = _userId;
    if (socket != null && userId != null && userId.isNotEmpty) {
      socket.emit('leave_user', {'userId': userId});
    }
    socket?.dispose();
    _socket = null;
    _userId = null;
    _onUserEvent = null;
  }
}
