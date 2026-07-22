import 'package:flutter/material.dart';

import '../../artists/data/artists_api.dart';
import '../../artists/presentation/pages/artist_profile_page.dart';
import '../../artists/presentation/pages/ranking_popularity_page.dart';
import '../../auth/data/auth_service.dart';
import '../../hall_of_fame/presentation/pages/hall_of_fame_page.dart';
import '../../home/presentation/pages/news_page.dart';
import '../../polls/presentation/pages/poll_detail_page.dart';
import '../../users/presentation/pages/user_profile_page.dart';
import '../data/app_notification.dart';
import '../presentation/pages/notifications_page.dart';
import 'notification_controller.dart';

/// Navega a la pantalla correcta según el `url` / tipo de una notificación.
class NotificationDeepLink {
  NotificationDeepLink._();

  /// Abre el destino de un [AppNotification] de la bandeja in-app.
  static Future<void> openFromNotification(
    BuildContext context, {
    required AuthService authService,
    required AppNotification notification,
    NotificationController? controller,
    void Function(String section)? onSelectSection,
    bool fromInbox = false,
  }) {
    final data = <String, dynamic>{
      ...notification.payload,
      'type': notification.type,
    };
    return open(
      context,
      authService: authService,
      data: data,
      controller: controller,
      onSelectSection: onSelectSection,
      fromInbox: fromInbox,
    );
  }

  /// Abre el destino desde el `data` de un push FCM / notificación local.
  static Future<void> open(
    BuildContext context, {
    required AuthService authService,
    required Map<String, dynamic> data,
    NotificationController? controller,
    void Function(String section)? onSelectSection,
    bool fromInbox = false,
  }) async {
    final path = _resolvePath(data);
    final type = '${data['type'] ?? ''}'.trim();

    if (!context.mounted) return;

    // Regalos: el modal se maneja aparte; desde la bandeja no reabrimos nada.
    if (type == 'admin_points_gift') {
      if (fromInbox) return;
      onSelectSection?.call('Inicio');
      if (controller != null) {
        await NotificationsScreen.open(
          context,
          controller: controller,
          onSelectSection: onSelectSection,
        );
      }
      return;
    }

    if (path == null || path.isEmpty || path == '/') {
      onSelectSection?.call('Inicio');
      return;
    }

    final segments = path
        .split('/')
        .where((part) => part.isNotEmpty)
        .toList(growable: false);

    if (segments.isEmpty) {
      onSelectSection?.call('Inicio');
      return;
    }

    final root = segments.first;

    switch (root) {
      case 'notificaciones':
      case 'notifications':
        if (fromInbox) return;
        if (controller != null) {
          await NotificationsScreen.open(
            context,
            controller: controller,
            onSelectSection: onSelectSection,
          );
        }
        return;
      case 'noticias':
      case 'news':
        await NewsScreen.open(context, authService: authService);
        return;
      case 'votaciones':
      case 'polls':
        onSelectSection?.call('Votaciones');
        return;
      case 'artistas':
      case 'artists':
        onSelectSection?.call('Artistas');
        return;
      case 'misiones':
      case 'missions':
        onSelectSection?.call('Misiones');
        return;
      case 'salon-de-la-fama':
      case 'hall-of-fame':
        await HallOfFameScreen.open(context, authService: authService);
        return;
      case 'ranking-popularity':
        await Navigator.of(context).push<void>(
          MaterialPageRoute(
            builder: (_) => Scaffold(
              backgroundColor: const Color(0xFF05010E),
              appBar: AppBar(
                backgroundColor: Colors.transparent,
                foregroundColor: Colors.white,
              ),
              body: RankingPopularityPage(authService: authService),
            ),
          ),
        );
        return;
      case 'perfil':
      case 'profile':
        await Navigator.of(context).push<void>(
          MaterialPageRoute(
            builder: (_) => UserProfilePage(authService: authService),
          ),
        );
        return;
      case 'user':
        if (segments.length >= 2) {
          await Navigator.of(context).push<void>(
            MaterialPageRoute(
              builder: (_) => UserProfilePage(
                authService: authService,
                username: segments[1],
              ),
            ),
          );
        }
        return;
      case 'artista':
      case 'artist':
        final artistId =
            segments.length >= 2
                ? segments[1]
                : '${data['artistId'] ?? ''}'.trim();
        if (artistId.isEmpty) {
          onSelectSection?.call('Artistas');
          return;
        }
        await _openArtist(context, authService: authService, artistId: artistId);
        return;
      case 'votacion':
      case 'poll':
        if (segments.length == 1 ||
            (segments.length >= 2 &&
                (segments[1] == 'lista' || segments[1] == 'versus'))) {
          onSelectSection?.call('Votaciones');
          return;
        }
        // /votacion|poll/2026/slug  o  /votacion|poll/slug
        final pollId = segments.length >= 3 ? segments[2] : segments[1];
        await PollDetailPage.open(
          context,
          authService: authService,
          pollId: pollId,
        );
        return;
      default:
        // Fallback: si hay artistId en el payload, abrir artista.
        final artistId = '${data['artistId'] ?? ''}'.trim();
        if (artistId.isNotEmpty || type == 'artist_push') {
          if (artistId.isNotEmpty) {
            await _openArtist(
              context,
              authService: authService,
              artistId: artistId,
            );
            return;
          }
        }
        if (fromInbox) return;
        if (controller != null) {
          await NotificationsScreen.open(
            context,
            controller: controller,
            onSelectSection: onSelectSection,
          );
        } else {
          onSelectSection?.call('Inicio');
        }
    }
  }

  static Future<void> _openArtist(
    BuildContext context, {
    required AuthService authService,
    required String artistId,
  }) async {
    try {
      final artist = await ArtistsApi(authService.client).getArtist(artistId);
      if (!context.mounted) return;
      await Navigator.of(context).push<void>(
        MaterialPageRoute(
          builder: (_) => ArtistProfilePage(
            artist: artist,
            authService: authService,
          ),
        ),
      );
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudo abrir el perfil del artista')),
      );
    }
  }

  /// Normaliza `url` absoluta o relativa a un path tipo `/artista/foo`.
  static String? _resolvePath(Map<String, dynamic> data) {
    final raw = '${data['url'] ?? data['link'] ?? ''}'.trim();
    if (raw.isEmpty) {
      final artistId = '${data['artistId'] ?? ''}'.trim();
      if (artistId.isNotEmpty) return '/artista/$artistId';
      return null;
    }

    if (raw.startsWith('/')) {
      return raw.split('?').first.split('#').first;
    }

    final uri = Uri.tryParse(raw);
    if (uri == null) return raw.startsWith('/') ? raw : '/$raw';

    if (uri.hasScheme && (uri.scheme == 'http' || uri.scheme == 'https')) {
      final path = uri.path.isEmpty ? '/' : uri.path;
      return path;
    }

    // Path relativo sin slash inicial.
    return '/${raw.split('?').first.split('#').first}';
  }
}
