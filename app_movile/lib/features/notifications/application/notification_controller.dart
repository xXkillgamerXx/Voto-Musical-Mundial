import 'dart:async';

import 'package:flutter/widgets.dart';

import '../../auth/data/auth_service.dart';
import '../../../core/notifications/push_notification_service.dart';
import '../../../core/storage/gift_notification_storage.dart';
import '../data/app_notification.dart';
import '../data/notification_display.dart';
import '../data/notifications_api.dart';
import '../data/user_realtime_service.dart';

class NotificationController extends ChangeNotifier {
  NotificationController(this.authService);

  final AuthService authService;

  static const _maxGiftAge = Duration(days: 7);
  static const _pollInterval = Duration(seconds: 30);

  final List<AppNotification> _notifications = [];
  final UserRealtimeService _realtime = UserRealtimeService();

  AppNotification? _giftNotification;
  bool _loading = false;
  String? _errorMessage;
  bool _pushEnabled = false;
  bool _initialized = false;
  Timer? _pollTimer;

  List<AppNotification> get notifications => List.unmodifiable(_notifications);

  List<AppNotification> get visibleNotifications =>
      _notifications.where(shouldDisplayNotification).toList(growable: false);

  int get unreadCount =>
      visibleNotifications.where((item) => item.isUnread).length;

  AppNotification? get giftNotification => _giftNotification;
  bool get loading => _loading;
  String? get errorMessage => _errorMessage;
  bool get pushEnabled => _pushEnabled;

  Future<void> initialize() async {
    if (_initialized) {
      return;
    }

    _initialized = true;
    PushNotificationService.instance.onForegroundMessage =
        () => unawaited(refresh(forceGift: true));
    PushNotificationService.instance.onGiftPush = (data) {
      unawaited(_handleGiftPush(data));
    };
    await PushNotificationService.instance.initialize();
    unawaited(
      PushNotificationService.instance.ensureTokenRegistered(authService),
    );
    _startRealtime();
    _pollTimer = Timer.periodic(
      _pollInterval,
      (_) => unawaited(refresh(forceGift: true)),
    );
    await refresh(forceGift: true);
  }

  void _startRealtime() {
    final user = authService.session.user;
    final token = authService.session.auth?.accessToken;
    if (user == null || user.id.isEmpty || token == null || token.isEmpty) {
      debugPrint('[VMM-REALTIME] No se pudo suscribir: user/token vacío');
      return;
    }

    debugPrint('[VMM-REALTIME] Suscribiendo user ${user.id}');
    _realtime.subscribe(
      userId: user.id,
      accessToken: token,
      onUserEvent: (event) {
        unawaited(_handleUserEvent(event));
      },
    );
  }

  Future<void> _handleUserEvent(Map<String, dynamic> event) async {
    if ('${event['type'] ?? ''}' != 'points_gift') {
      return;
    }

    await _showGiftFromPayload(
      amount: _toInt(event['amount']),
      points: _toInt(event['points']),
      title: '${event['title'] ?? 'Te enviaron un regalo'}',
      message: event['message']?.toString(),
    );
  }

  Future<void> _handleGiftPush(Map<String, dynamic> data) async {
    await _showGiftFromPayload(
      amount: _toInt(data['amount']),
      points: authService.session.user?.points ?? 0,
      title: '${data['title'] ?? 'Te enviaron un regalo'}',
      message: data['body']?.toString() ?? data['message']?.toString(),
    );
    unawaited(refresh(forceGift: true));
  }

  Future<void> _showGiftFromPayload({
    required int amount,
    required int points,
    required String title,
    String? message,
  }) async {
    debugPrint('[VMM-REALTIME] Regalo recibido');

    final user = authService.session.user;
    final pointsBefore = user != null && points > amount
        ? points - amount
        : (user?.points ?? 0);

    _giftNotification = AppNotification(
      id: 'realtime-${DateTime.now().millisecondsSinceEpoch}',
      type: 'admin_points_gift',
      payload: {
        if (amount > 0) 'amount': amount,
        if (pointsBefore > 0) 'pointsBefore': pointsBefore,
        if (points > 0) 'pointsAfter': points,
        'title': title,
        'message': message ??
            (amount > 0
                ? 'Recibiste $amount puntos de regalo.'
                : 'Recibiste puntos de regalo.'),
      },
      createdAt: DateTime.now(),
    );
    _notifySafely();

    if (user != null && points > 0) {
      unawaited(authService.session.updateUser(user.copyWith(points: points)));
    }

    unawaited(_syncGiftFromBackend());
  }

  Future<void> _syncGiftFromBackend() async {
    for (var attempt = 0; attempt < 6; attempt++) {
      if (attempt > 0) {
        await Future.delayed(Duration(milliseconds: 250 * attempt));
      }

      await refresh(forceGift: true);

      final gift = _giftNotification;
      if (gift != null && !gift.id.startsWith('realtime-')) {
        return;
      }
    }
  }

  Future<void> refresh({bool forceGift = false}) async {
    if (!authService.session.isSignedIn) {
      _notifications.clear();
      _giftNotification = null;
      _notifySafely();
      return;
    }

    final wasLoading = _loading;
    if (!wasLoading) {
      _loading = true;
      _errorMessage = null;
      _notifySafely();
    }

    try {
      final items = await NotificationsApi(authService.client).getNotifications(
        limit: 40,
      );
      _notifications
        ..clear()
        ..addAll(items);

      if (forceGift) {
        await _loadGiftNotification();
      } else if (_giftNotification == null) {
        await _loadGiftNotification();
      }
    } catch (_) {
      _errorMessage = 'No se pudieron cargar las notificaciones.';
    } finally {
      if (!wasLoading) {
        _loading = false;
      }
      _notifySafely();
    }
  }

  Future<void> _loadGiftNotification() async {
    final seen = await GiftNotificationStorage.readSeenIds();
    AppNotification? nextGift;

    for (final notification in _notifications) {
      if (!_shouldShowGift(notification, seen)) {
        continue;
      }
      nextGift = notification;
      break;
    }

    _giftNotification = nextGift ?? _giftNotification;
  }

  bool _shouldShowGift(AppNotification notification, Set<String> seen) {
    if (!isGiftNotification(notification) || !notification.isUnread) {
      return false;
    }

    if (seen.contains(notification.id)) {
      return false;
    }

    final createdAt = notification.createdAt;
    if (createdAt == null) {
      return false;
    }

    return DateTime.now().difference(createdAt) <= _maxGiftAge;
  }

  Future<void> markRead(AppNotification notification) async {
    if (!notification.isUnread || notification.id.startsWith('realtime-')) {
      return;
    }

    final index = _notifications.indexWhere((item) => item.id == notification.id);
    if (index >= 0) {
      _notifications[index] = notification.copyWith(readAt: DateTime.now());
      _notifySafely();
    }

    await NotificationsApi(authService.client).markRead(notification.id);
  }

  Future<void> markAllRead() async {
    final unread = visibleNotifications.where((item) => item.isUnread).toList();
    if (unread.isEmpty) {
      return;
    }

    for (var index = 0; index < _notifications.length; index++) {
      final item = _notifications[index];
      if (!item.isUnread) {
        continue;
      }
      _notifications[index] = item.copyWith(readAt: DateTime.now());
    }
    _notifySafely();

    await Future.wait(
      unread.map((item) => NotificationsApi(authService.client).markRead(item.id)),
    );
  }

  Future<void> closeGift() async {
    final notification = _giftNotification;
    _giftNotification = null;
    _notifySafely();

    if (notification == null) {
      return;
    }

    if (notification.id.startsWith('realtime-')) {
      await refresh(forceGift: true);
      final syncedGift = _giftNotification;
      if (syncedGift != null && !syncedGift.id.startsWith('realtime-')) {
        await GiftNotificationStorage.rememberSeen(syncedGift.id);
        await markRead(syncedGift);
        _giftNotification = null;
        _notifySafely();
      }
      return;
    }

    await GiftNotificationStorage.rememberSeen(notification.id);
    await markRead(notification);
  }

  void clearGiftOverlay() {
    _giftNotification = null;
    _notifySafely();
  }

  Future<bool> enablePush() async {
    final enabled = await PushNotificationService.instance
        .requestPermissionAndRegister(authService);
    final registered = await PushNotificationService.instance
        .ensureTokenRegistered(authService);
    _pushEnabled = enabled || registered;
    _notifySafely();
    return _pushEnabled;
  }

  bool _notifyScheduled = false;

  void _notifySafely() {
    if (!hasListeners || _notifyScheduled) {
      return;
    }

    _notifyScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _notifyScheduled = false;
      if (hasListeners) {
        notifyListeners();
      }
    });
  }

  int _toInt(Object? value) {
    if (value is int) return value;
    if (value is num) return value.round();
    return int.tryParse('$value') ?? 0;
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _realtime.dispose();
    PushNotificationService.instance.onForegroundMessage = null;
    PushNotificationService.instance.onGiftPush = null;
    super.dispose();
  }
}
