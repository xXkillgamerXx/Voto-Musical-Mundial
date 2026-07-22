import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../features/auth/data/auth_service.dart';
import '../../features/notifications/data/notifications_api.dart';
import '../../firebase_options.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  debugPrint('[VMM-PUSH] Mensaje en background: ${message.messageId}');
}

class PushNotificationService {
  PushNotificationService._();

  static final PushNotificationService instance = PushNotificationService._();

  FirebaseMessaging get _messaging => FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  bool _initialized = false;
  bool _tokenRefreshAttached = false;
  String? _currentToken;

  /// Se dispara al recibir push en foreground (para refrescar la bandeja).
  VoidCallback? onForegroundMessage;

  /// Regalo en foreground.
  void Function(Map<String, dynamic> data)? onGiftPush;

  /// Usuario tocó una notificación (push o local) y hay que abrir una vista.
  void Function(Map<String, dynamic> data)? onNotificationOpened;

  /// Deep link pendiente si el tap ocurrió antes de que AuthGate estuviera listo.
  Map<String, dynamic>? pendingOpenData;

  String? get currentToken => _currentToken;

  Future<void> initialize() async {
    if (_initialized || kIsWeb) {
      return;
    }

    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const initSettings = InitializationSettings(android: androidSettings);
    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: _handleLocalNotificationResponse,
    );

    if (Platform.isAndroid) {
      const channel = AndroidNotificationChannel(
        'vmm_default',
        'Music Mundial VOTE',
        description: 'Regalos, misiones y avisos importantes',
        importance: Importance.high,
      );

      await _localNotifications
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >()
          ?.createNotificationChannel(channel);
    }

    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);
    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      _log('App abierta desde push: ${message.messageId}');
      onForegroundMessage?.call();
      _emitOpened(Map<String, dynamic>.from(message.data));
    });

    unawaited(
      _messaging.getInitialMessage().then((message) {
        if (message != null) {
          _log('Push inicial al abrir app: ${message.messageId}');
          onForegroundMessage?.call();
          _emitOpened(Map<String, dynamic>.from(message.data));
        }
      }),
    );

    // Si la app se abrió tocando una notificación local (foreground → banner).
    final launchDetails = await _localNotifications
        .getNotificationAppLaunchDetails();
    if (launchDetails?.didNotificationLaunchApp == true) {
      final response = launchDetails!.notificationResponse;
      if (response != null) {
        _handleLocalNotificationResponse(response);
      }
    }

    _initialized = true;
    unawaited(_logCurrentToken('init'));
  }

  /// Registra el handler de apertura y consume cualquier deep link pendiente.
  void bindOpenHandler(void Function(Map<String, dynamic> data)? handler) {
    onNotificationOpened = handler;
    final pending = pendingOpenData;
    if (handler != null && pending != null) {
      pendingOpenData = null;
      handler(pending);
    }
  }

  void unbindOpenHandler() {
    onNotificationOpened = null;
  }

  Future<bool> requestPermissionAndRegister(AuthService authService) async {
    if (!_initialized) {
      await initialize();
    }

    if (kIsWeb) {
      return false;
    }

    final notificationsAllowed = await _requestNotificationPermission();
    return ensureTokenRegistered(
      authService,
      permission: notificationsAllowed ? 'granted' : 'denied',
    );
  }

  Future<bool> ensureTokenRegistered(
    AuthService authService, {
    String permission = 'granted',
  }) async {
    if (!_initialized) {
      await initialize();
    }

    if (kIsWeb || !authService.session.isSignedIn) {
      return false;
    }

    try {
      final token = await _messaging.getToken();
      if (token == null || token.isEmpty) {
        _log('FCM token vacío o null');
        return false;
      }

      await _persistAndRegisterToken(
        authService: authService,
        token: token,
        permission: permission,
      );

      _attachTokenRefreshListener(authService);
      return true;
    } catch (error, stack) {
      _log('Error obteniendo FCM token: $error');
      debugPrintStack(stackTrace: stack);
      return false;
    }
  }

  Future<bool> _requestNotificationPermission() async {
    if (Platform.isAndroid) {
      final granted = await _localNotifications
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >()
          ?.requestNotificationsPermission();
      _log('Permiso Android POST_NOTIFICATIONS: ${granted ?? true}');
      return granted ?? true;
    }

    if (Platform.isIOS) {
      final settings = await _messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      final authorized =
          settings.authorizationStatus == AuthorizationStatus.authorized ||
          settings.authorizationStatus == AuthorizationStatus.provisional;
      _log('Permiso iOS: ${settings.authorizationStatus}');
      return authorized;
    }

    return true;
  }

  Future<void> _persistAndRegisterToken({
    required AuthService authService,
    required String token,
    required String permission,
  }) async {
    _currentToken = token;
    _log('FCM token: $token');

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('vmm_fcm_token', token);

    if (!authService.session.isSignedIn) {
      _log('Usuario no autenticado; token guardado localmente');
      return;
    }

    try {
      await NotificationsApi(authService.client).registerPushToken(
        token: token,
        platform: Platform.isIOS ? 'ios' : 'android',
        permission: permission,
      );
      _log('Token registrado en backend OK');
    } catch (error, stack) {
      _log('Error registrando token en backend: $error');
      debugPrintStack(stackTrace: stack);
    }
  }

  void _attachTokenRefreshListener(AuthService authService) {
    if (_tokenRefreshAttached) {
      return;
    }

    _tokenRefreshAttached = true;
    FirebaseMessaging.instance.onTokenRefresh.listen((nextToken) async {
      _log('FCM token refresh: $nextToken');
      await _persistAndRegisterToken(
        authService: authService,
        token: nextToken,
        permission: 'granted',
      );
    });
  }

  Future<void> unregister(AuthService authService) async {
    final prefs = await SharedPreferences.getInstance();
    final token = _currentToken ?? prefs.getString('vmm_fcm_token');
    if (token == null || token.isEmpty || !authService.session.isSignedIn) {
      return;
    }

    await NotificationsApi(authService.client).unregisterPushToken(token);
    _log('Token eliminado del backend');
  }

  Future<void> _logCurrentToken(String source) async {
    try {
      final token = await _messaging.getToken();
      _currentToken = token;
      _log('FCM token ($source): ${token ?? 'null'}');
    } catch (error) {
      _log('No se pudo leer token ($source): $error');
    }
  }

  void _handleForegroundMessage(RemoteMessage message) {
    final dataType = message.data['type'] ?? '';
    _log(
      'Push foreground: type=$dataType id=${message.messageId} title=${message.notification?.title ?? message.data['title']}',
    );

    if (dataType == 'admin_points_gift') {
      onGiftPush?.call(Map<String, dynamic>.from(message.data));
    }

    onForegroundMessage?.call();

    final title = message.notification?.title ?? message.data['title'];
    final body = message.notification?.body ?? message.data['body'];
    if (title == null && body == null) {
      return;
    }

    final payload = jsonEncode(message.data);

    _localNotifications.show(
      message.hashCode,
      title,
      body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'vmm_default',
          'Music Mundial VOTE',
          importance: Importance.high,
          priority: Priority.high,
        ),
      ),
      payload: payload,
    );
  }

  void _handleLocalNotificationResponse(NotificationResponse response) {
    final raw = response.payload;
    if (raw == null || raw.isEmpty) {
      _emitOpened(const {});
      return;
    }

    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) {
        _emitOpened(decoded);
        return;
      }
      if (decoded is Map) {
        _emitOpened(Map<String, dynamic>.from(decoded));
        return;
      }
    } catch (_) {
      // Payload no JSON: tratar como url directa.
      _emitOpened({'url': raw});
      return;
    }

    _emitOpened(const {});
  }

  void _emitOpened(Map<String, dynamic> data) {
    _log('Abrir desde notificación: $data');
    final handler = onNotificationOpened;
    if (handler != null) {
      handler(data);
      return;
    }
    pendingOpenData = data;
  }

  void _log(String message) {
    debugPrint('[VMM-PUSH] $message');
  }
}
