import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/foundation.dart';

import '../referrals/referral_storage.dart';

/// Escucha links HTTPS (App Links) y el scheme `vmm://` para abrir pantallas.
class AppDeepLinkService {
  AppDeepLinkService._();

  static final AppDeepLinkService instance = AppDeepLinkService._();

  final AppLinks _appLinks = AppLinks();
  StreamSubscription<Uri>? _subscription;
  StreamSubscription<Uri>? _referralSubscription;
  void Function(Uri uri)? _handler;
  Uri? _pending;

  /// Último link pendiente (cold start antes de estar logueado).
  Uri? get pending => _pending;

  Future<void> start(void Function(Uri uri) handler) async {
    _handler = handler;

    try {
      final initial = await _appLinks.getInitialLink();
      if (initial != null) {
        _deliver(initial);
      }
    } catch (error) {
      debugPrint('AppDeepLink initial: $error');
    }

    await _subscription?.cancel();
    _subscription = _appLinks.uriLinkStream.listen(
      _deliver,
      onError: (Object error) {
        debugPrint('AppDeepLink stream: $error');
      },
    );
  }

  void _deliver(Uri uri) {
    final handler = _handler;
    if (handler == null) {
      _pending = uri;
      return;
    }

    _pending = null;
    handler(uri);
  }

  /// El invitado abre el link sin sesión, así que el código de referido se
  /// captura aparte: el handler de navegación solo arranca después del login.
  Future<void> startReferralCapture() async {
    try {
      final initial = await _appLinks.getInitialLink();
      if (initial != null) {
        await ReferralStorage.captureFromUri(initial);
      }
    } catch (error) {
      debugPrint('AppDeepLink referral: $error');
    }

    await _referralSubscription?.cancel();
    _referralSubscription = _appLinks.uriLinkStream.listen(
      (uri) => unawaited(ReferralStorage.captureFromUri(uri)),
      onError: (Object error) {
        debugPrint('AppDeepLink referral stream: $error');
      },
    );
  }

  /// Entrega un pending guardado (p. ej. tras login).
  void flushPending() {
    final pending = _pending;
    final handler = _handler;
    if (pending == null || handler == null) {
      return;
    }
    _pending = null;
    handler(pending);
  }

  Future<void> stop() async {
    await _subscription?.cancel();
    _subscription = null;
    _handler = null;
  }

  /// Convierte un URI de app/web en el path interno que usa [NotificationDeepLink].
  static String? pathFromUri(Uri uri) {
    final host = uri.host.toLowerCase();
    final isWebHost =
        host == 'vote.musicmundial.com' ||
        host == 'www.vote.musicmundial.com' ||
        host.isEmpty;
    final isCustomScheme = uri.scheme.toLowerCase() == 'vmm';

    if (!isWebHost && !isCustomScheme) {
      return null;
    }

    var path = uri.path;
    if (path.isEmpty || path == '/') {
      // vmm://votacion/2026/slug  (host = primer segmento)
      if (isCustomScheme && uri.host.isNotEmpty) {
        path = '/${uri.host}${uri.path}';
      } else {
        return '/';
      }
    }

    if (!path.startsWith('/')) {
      path = '/$path';
    }

    return path;
  }
}
