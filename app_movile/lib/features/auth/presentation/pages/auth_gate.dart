import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/auth/auth_models.dart';
import '../../../../core/auth/auth_session.dart';
import '../../../../core/ads/ad_service.dart';
import '../../../../core/i18n/tr.dart';
import '../../../../core/navigation/app_deep_link.dart';
import '../../../../core/notifications/push_notification_service.dart';
import '../../../../core/rewards/app_first_open_reward.dart';
import '../../../../core/storage/daily_reward_storage.dart';
import '../../../../core/widgets/points_chip.dart';
import '../../../artists/presentation/pages/artists_page.dart';
import '../../../artists/presentation/pages/ranking_popularity_page.dart';
import '../../../home/data/poll_category.dart';
import '../../../home/presentation/pages/home_page.dart';
import '../../../home/presentation/pages/missions_page.dart';
import '../../../home/presentation/pages/news_page.dart';
import '../../../hall_of_fame/presentation/pages/hall_of_fame_page.dart';
import '../../../notifications/application/notification_controller.dart';
import '../../../notifications/application/notification_deep_link.dart';
import '../../../notifications/presentation/pages/notifications_page.dart';
import '../../../notifications/presentation/widgets/foreground_push_banner.dart';
import '../../../notifications/presentation/widgets/gift_notification_modal.dart';
import '../../../notifications/presentation/widgets/notifications_bell.dart';
import '../../../polls/presentation/pages/polls_page.dart';
import '../../../rewards/presentation/widgets/daily_reward_modal.dart';
import '../../../settings/presentation/pages/settings_page.dart';
import '../../../users/presentation/pages/user_profile_page.dart';
import '../../data/auth_service.dart';
import 'login_page.dart';

/// Traduce el nombre visible de una sección manteniendo su identificador
/// interno (en español) para la lógica de navegación.
String _sectionTitle(String section) => tr('section.$section');

class AuthGate extends StatefulWidget {
  const AuthGate({required this.authService, super.key});

  final AuthService authService;

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  @override
  void initState() {
    super.initState();
    widget.authService.getMe();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.authService.session,
      builder: (context, _) {
        final session = widget.authService.session;

        if (!session.isReady) {
          return const Scaffold(
            body: _HomeBackground(
              child: Center(child: CircularProgressIndicator()),
            ),
          );
        }

        final user = session.user;

        if (user == null) {
          return LoginPage(authService: widget.authService);
        }

        return _SignedInPage(user: user, authService: widget.authService);
      },
    );
  }
}

class _SignedInPage extends StatefulWidget {
  const _SignedInPage({required this.user, required this.authService});

  final ApiUser user;
  final AuthService authService;

  @override
  State<_SignedInPage> createState() => _SignedInPageState();
}

class _SignedInPageState extends State<_SignedInPage> {
  late final PageController _pageController;
  late final NotificationController _notifications;
  final GlobalKey<NavigatorState> _shellNavigatorKey =
      GlobalKey<NavigatorState>();
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  String _selectedSection = 'Inicio';
  bool _dailyRewardPromptChecked = false;
  final ValueNotifier<PollsCategoryFilter?> _pollsCategoryFilter =
      ValueNotifier<PollsCategoryFilter?>(null);

  static const _tabSections = [
    'Inicio',
    'Votaciones',
    'Artistas',
    'Misiones',
  ];

  /// Espacio para que el contenido no quede bajo el menú flotante.
  static const _bottomNavClearance = 78.0;

  static const _shellBg = Color(0xFF050213);

  int get _selectedTabIndex => _tabSections.indexOf(_selectedSection);

  NavigatorState? get _shellNavigator => _shellNavigatorKey.currentState;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: _selectedTabIndex);
    _notifications = NotificationController(widget.authService);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_notifications.initialize());
      unawaited(_maybeClaimAppFirstOpen());
      unawaited(_maybeShowDailyReward());
      unawaited(_notifications.enablePush());
      PushNotificationService.instance.bindOpenHandler(_handlePushOpened);
      unawaited(_startDeepLinks());
    });
  }

  Future<void> _maybeClaimAppFirstOpen() async {
    if (!mounted) return;
    await maybeClaimAppFirstOpenReward(
      context: context,
      authService: widget.authService,
    );
  }

  Future<void> _startDeepLinks() async {
    await AppDeepLinkService.instance.start(_handleIncomingDeepLink);
    AppDeepLinkService.instance.flushPending();
  }

  void _handleIncomingDeepLink(Uri uri) {
    final path = AppDeepLinkService.pathFromUri(uri);
    if (path == null) {
      return;
    }

    final navContext = _shellNavigatorKey.currentContext ?? context;
    if (!mounted) {
      return;
    }

    unawaited(
      NotificationDeepLink.open(
        navContext,
        authService: widget.authService,
        data: {
          'url': path,
          if (uri.queryParameters.isNotEmpty) ...uri.queryParameters,
        },
        controller: _notifications,
        onSelectSection: _selectSection,
      ),
    );
  }

  void _handlePushOpened(Map<String, dynamic> data) {
    final navContext = _shellNavigatorKey.currentContext ?? context;
    if (!mounted) return;
    unawaited(
      NotificationDeepLink.open(
        navContext,
        authService: widget.authService,
        data: data,
        controller: _notifications,
        onSelectSection: _selectSection,
      ),
    );
  }

  Future<void> _maybeShowDailyReward() async {
    if (_dailyRewardPromptChecked || !mounted) {
      return;
    }

    _dailyRewardPromptChecked = true;

    final user = await widget.authService.getMe();
    if (!mounted || user == null) {
      return;
    }

    if (user.hasClaimedDailyRewardToday) {
      return;
    }

    if (await DailyRewardStorage.wasDismissedToday()) {
      return;
    }

    if (!mounted) {
      return;
    }

    await DailyRewardModal.show(context, authService: widget.authService);
  }

  @override
  void dispose() {
    unawaited(AppDeepLinkService.instance.stop());
    PushNotificationService.instance.unbindOpenHandler();
    _notifications.dispose();
    _pollsCategoryFilter.dispose();
    _pageController.dispose();
    super.dispose();
  }

  Future<bool> _confirmExitApp() async {
    final shouldExit = await showDialog<bool>(
      context: context,
      barrierDismissible: true,
      builder: (dialogContext) {
        return Dialog(
          backgroundColor: Colors.transparent,
          insetPadding: const EdgeInsets.symmetric(horizontal: 28),
          child: Container(
            padding: const EdgeInsets.fromLTRB(22, 22, 22, 18),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                color: const Color(0xFFC084FC).withValues(alpha: 0.35),
              ),
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0xFF1A1035),
                  Color(0xFF0B0818),
                ],
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 54,
                  height: 54,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    color: const Color(0xFF7C3AED).withValues(alpha: 0.18),
                    border: Border.all(
                      color: const Color(0xFFC084FC).withValues(alpha: 0.35),
                    ),
                  ),
                  child: const Icon(
                    Icons.logout_rounded,
                    color: Color(0xFFE9D5FF),
                    size: 26,
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  tr('misc.exitAppTitle'),
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.4,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  tr('misc.exitAppConfirm'),
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Color(0xFFD8D3F7),
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () =>
                            Navigator.of(dialogContext).pop(false),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFFC084FC),
                          minimumSize: const Size.fromHeight(50),
                          side: const BorderSide(
                            color: Color(0xFFC084FC),
                            width: 1.5,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                          textStyle: const TextStyle(
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        child: Text(tr('misc.exitAppCancel')),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton(
                        onPressed: () =>
                            Navigator.of(dialogContext).pop(true),
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFFFF21C8),
                          foregroundColor: Colors.white,
                          minimumSize: const Size.fromHeight(50),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                          textStyle: const TextStyle(
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        child: Text(tr('misc.exitAppYes')),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
    return shouldExit == true;
  }

  Future<void> _handleRootBack() async {
    final scaffold = _scaffoldKey.currentState;
    if (scaffold?.isDrawerOpen == true) {
      scaffold!.closeDrawer();
      return;
    }

    final nav = _shellNavigator;
    if (nav != null && nav.canPop()) {
      nav.pop();
      return;
    }

    if (_selectedSection != 'Inicio') {
      _selectSection('Inicio');
      return;
    }

    final shouldExit = await _confirmExitApp();
    if (shouldExit && mounted) {
      SystemNavigator.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        unawaited(_handleRootBack());
      },
      child: Stack(
      children: [
        _HomeBackground(
          child: Scaffold(
            key: _scaffoldKey,
            extendBody: true,
            backgroundColor: Colors.transparent,
            drawer: _HomeMenuDrawer(
              user: widget.user,
              authService: widget.authService,
              selectedSection: _selectedSection,
              shellNavigatorKey: _shellNavigatorKey,
              onSectionSelected: (section) {
                Navigator.of(context).pop();
                if (section == 'Noticias') {
                  _pushInShell(
                    NewsScreen(authService: widget.authService),
                  );
                  return;
                }
                if (section == 'Notificaciones') {
                  _pushInShell(
                    NotificationsScreen(
                      controller: _notifications,
                      onSelectSection: _selectSection,
                    ),
                  );
                  return;
                }
                if (section == 'Salón de la fama') {
                  _pushInShell(
                    HallOfFameScreen(authService: widget.authService),
                  );
                  return;
                }
                if (section == 'Ranking Popularity') {
                  _openRankingPopularity();
                  return;
                }
                _selectSection(section);
              },
            ),
            // Padding fijo: evita setState al abrir rutas (flash blanco).
            body: MediaQuery(
              data: media.copyWith(
                padding: media.padding.copyWith(
                  bottom: media.padding.bottom + _bottomNavClearance,
                ),
              ),
              child: Navigator(
                key: _shellNavigatorKey,
                onGenerateRoute: (settings) {
                  return PageRouteBuilder<void>(
                    settings: settings,
                    opaque: true,
                    pageBuilder: (context, animation, secondaryAnimation) {
                      return ColoredBox(
                        color: _shellBg,
                        child: _buildSectionContent(),
                      );
                    },
                    transitionsBuilder:
                        (context, animation, secondaryAnimation, child) {
                      return child;
                    },
                  );
                },
              ),
            ),
            bottomNavigationBar: _HomeBottomNav(
              selectedSection: _selectedSection,
              onSectionSelected: _selectSection,
            ),
          ),
        ),
        ListenableBuilder(
          listenable: _notifications,
          builder: (context, _) {
            final gift = _notifications.giftNotification;
            if (gift == null) {
              return const SizedBox.shrink();
            }

            return GiftNotificationModal(
              notification: gift,
              authService: widget.authService,
              onClose: _notifications.closeGift,
            );
          },
        ),
        ListenableBuilder(
          listenable: _notifications,
          builder: (context, _) {
            final banner = _notifications.foregroundBanner;
            if (banner == null) {
              return const SizedBox.shrink();
            }

            return ForegroundPushBannerToast(
              banner: banner,
              onDismiss: _notifications.clearForegroundBanner,
              onOpen: () {
                final data = Map<String, dynamic>.from(banner.data);
                _notifications.clearForegroundBanner();
                _handlePushOpened(data);
              },
            );
          },
        ),
        // Negro opaco detrás de interstitial/rewarded (AdActivity a veces es translucido).
        ValueListenableBuilder<bool>(
          valueListenable: AdService.fullscreenCover,
          builder: (context, visible, _) {
            if (!visible) return const SizedBox.shrink();
            return const Positioned.fill(
              child: ColoredBox(color: Color(0xFF000000)),
            );
          },
        ),
      ],
      ),
    );
  }

  void _pushInShell(Widget page) {
    _shellNavigator?.push<void>(
      PageRouteBuilder<void>(
        opaque: true,
        pageBuilder: (context, animation, secondaryAnimation) {
          return ColoredBox(color: _shellBg, child: page);
        },
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(
            opacity: CurvedAnimation(
              parent: animation,
              curve: Curves.easeOutCubic,
            ),
            child: child,
          );
        },
        transitionDuration: const Duration(milliseconds: 200),
      ),
    );
  }

  void _selectSection(String section, {bool clearPollsCategory = true}) {
    if (section == 'Ranking Popularity') {
      _openRankingPopularity();
      return;
    }

    if (clearPollsCategory && section == 'Votaciones') {
      _pollsCategoryFilter.value = null;
    }

    // Al cambiar de pestaña, vuelve al root del shell para que se vea el tab.
    _shellNavigator?.popUntil((route) => route.isFirst);

    final tabIndex = _tabSections.indexOf(section);

    setState(() => _selectedSection = section);

    void jumpToTab() {
      if (tabIndex != -1 && _pageController.hasClients) {
        _pageController.jumpToPage(tabIndex);
      }
    }

    jumpToTab();
    if (tabIndex != -1 && !_pageController.hasClients) {
      WidgetsBinding.instance.addPostFrameCallback((_) => jumpToTab());
    }
  }

  void _openPollsCategory(PollCategoryItem category) {
    _pollsCategoryFilter.value = PollsCategoryFilter(
      id: category.id,
      name: category.name,
    );
    _selectSection('Votaciones', clearPollsCategory: false);
  }

  void _openRankingPopularity() {
    _pushInShell(
      _HomeBackground(
        child: Scaffold(
          backgroundColor: Colors.transparent,
          appBar: AppBar(
            backgroundColor: Colors.transparent,
            elevation: 0,
            foregroundColor: Colors.white,
            title: Text(_sectionTitle('Ranking Popularity')),
            actions: [
              AppBarPointsAction(session: widget.authService.session),
            ],
          ),
          body: RankingPopularityPage(authService: widget.authService),
        ),
      ),
    );
  }

  Widget _buildSectionContent() {
    final tabIndex = _selectedTabIndex;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _ShellAppBar(
          selectedSection: _selectedSection,
          selectedTabIndex: _selectedTabIndex,
          session: widget.authService.session,
          notifications: _notifications,
          onSelectSection: _selectSection,
          shellNavigatorKey: _shellNavigatorKey,
        ),
        Expanded(
          child: tabIndex == -1
              ? _PlaceholderPanel(
                  title: _sectionTitle(_selectedSection),
                  subtitle: tr('auth.sectionPlaceholder'),
                )
              : ColoredBox(
                  color: _shellBg,
                  child: PageView(
                    controller: _pageController,
                    onPageChanged: (index) {
                      setState(() => _selectedSection = _tabSections[index]);
                    },
                    children: [
                      KeepAlivePanel(
                        child: HomePage(
                          authService: widget.authService,
                          onNavigateToSection: _selectSection,
                          onOpenCategory: _openPollsCategory,
                          onOpenNews: () => _pushInShell(
                            NewsScreen(authService: widget.authService),
                          ),
                        ),
                      ),
                      KeepAlivePanel(
                        child: PollsPage(
                          authService: widget.authService,
                          categoryFilter: _pollsCategoryFilter,
                        ),
                      ),
                      KeepAlivePanel(
                        child: ArtistsPage(authService: widget.authService),
                      ),
                      KeepAlivePanel(
                        child: MissionsPage(authService: widget.authService),
                      ),
                    ],
                  ),
                ),
        ),
      ],
    );
  }
}

class _ShellAppBar extends StatelessWidget implements PreferredSizeWidget {
  const _ShellAppBar({
    required this.selectedSection,
    required this.selectedTabIndex,
    required this.session,
    required this.notifications,
    required this.onSelectSection,
    required this.shellNavigatorKey,
  });

  final String selectedSection;
  final int selectedTabIndex;
  final AuthSession session;
  final NotificationController notifications;
  final ValueChanged<String> onSelectSection;
  final GlobalKey<NavigatorState> shellNavigatorKey;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: SafeArea(
        bottom: false,
        child: SizedBox(
          height: kToolbarHeight,
          child: NavigationToolbar(
            leading: IconButton(
              tooltip: tr('auth.openMenu'),
              onPressed: () => Scaffold.of(context).openDrawer(),
              icon: const Icon(Icons.menu_rounded, color: Colors.white),
            ),
            middle: (selectedSection == 'Inicio' ||
                    selectedSection == 'Artistas' ||
                    selectedSection == 'Votaciones' ||
                    selectedSection == 'Misiones')
                ? Image.asset(
                    'assets/icons/logo-votos.png',
                    width: 54,
                    height: 42,
                    fit: BoxFit.contain,
                  )
                : (selectedTabIndex == -1
                      ? Text(
                          _sectionTitle(selectedSection),
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                          ),
                        )
                      : null),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                AppBarPointsAction(session: session),
                NotificationsBell(
                  controller: notifications,
                  onSelectSection: onSelectSection,
                  navigatorKey: shellNavigatorKey,
                ),
                const SizedBox(width: 4),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class KeepAlivePanel extends StatefulWidget {
  const KeepAlivePanel({required this.child, super.key});

  final Widget child;

  @override
  State<KeepAlivePanel> createState() => _KeepAlivePanelState();
}

class _KeepAlivePanelState extends State<KeepAlivePanel>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return widget.child;
  }
}

class _PlaceholderPanel extends StatelessWidget {
  const _PlaceholderPanel({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return SizedBox.expand(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.auto_awesome_rounded,
                size: 72,
                color: Theme.of(context).colorScheme.primary,
              ),
              const SizedBox(height: 18),
              Text(
                title,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                subtitle,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0xFFD8D3F7)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HomeBottomNav extends StatelessWidget {
  const _HomeBottomNav({
    required this.selectedSection,
    required this.onSectionSelected,
  });

  final String selectedSection;
  final ValueChanged<String> onSectionSelected;

  static const _items = [
    _HomeMenuItem('Inicio', Icons.home_rounded),
    _HomeMenuItem('Votaciones', Icons.how_to_vote_rounded),
    _HomeMenuItem('Artistas', Icons.star_rounded),
    _HomeMenuItem('Misiones', Icons.flag_rounded),
  ];

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
          decoration: BoxDecoration(
            color: const Color(0xFF080416).withValues(alpha: 0.62),
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.22),
                blurRadius: 22,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Row(
            children: _items.map((item) {
              final isSelected = selectedSection == item.label;

              return Expanded(
                child: _BottomNavButton(
                  item: item,
                  isSelected: isSelected,
                  onTap: () => onSectionSelected(item.label),
                ),
              );
            }).toList(),
          ),
        ),
      ),
    );
  }
}

class _BottomNavButton extends StatelessWidget {
  const _BottomNavButton({
    required this.item,
    required this.isSelected,
    required this.onTap,
  });

  final _HomeMenuItem item;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            gradient: isSelected
                ? const LinearGradient(
                    colors: [Color(0xFF7C3AED), Color(0xFFFF21C8)],
                  )
                : null,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                item.icon,
                size: 20,
                color: isSelected ? Colors.white : const Color(0xFFB9B2D8),
              ),
              const SizedBox(height: 3),
              Text(
                _sectionTitle(item.label),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: isSelected ? Colors.white : const Color(0xFFB9B2D8),
                  fontSize: 10,
                  fontWeight: isSelected ? FontWeight.w900 : FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HomeMenuDrawer extends StatelessWidget {
  const _HomeMenuDrawer({
    required this.user,
    required this.authService,
    required this.selectedSection,
    required this.onSectionSelected,
    this.shellNavigatorKey,
  });

  final ApiUser user;
  final AuthService authService;
  final String selectedSection;
  final ValueChanged<String> onSectionSelected;
  final GlobalKey<NavigatorState>? shellNavigatorKey;

  static const _items = [
    _HomeMenuItem('Inicio', Icons.home_rounded),
    _HomeMenuItem('Noticias', Icons.article_rounded),
    _HomeMenuItem('Notificaciones', Icons.notifications_rounded),
    _HomeMenuItem('Votaciones', Icons.how_to_vote_rounded),
    _HomeMenuItem('Artistas', Icons.star_rounded),
    _HomeMenuItem('Ranking Popularity', Icons.leaderboard_rounded),
    _HomeMenuItem('Salón de la fama', Icons.workspace_premium_rounded),
  ];

  @override
  Widget build(BuildContext context) {
    return Drawer(
      backgroundColor: const Color(0xFF09061B),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.horizontal(right: Radius.circular(28)),
      ),
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF050213), Color(0xFF09061B), Color(0xFF160B35)],
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _DrawerHeader(
                  user: user,
                  session: authService.session,
                  onOpenProfile: () {
                    Navigator.of(context).pop();
                    final nav = shellNavigatorKey?.currentState;
                    final page = UserProfilePage(
                      authService: authService,
                      username: user.username.isEmpty ? null : user.username,
                    );
                    if (nav != null) {
                      nav.push(
                        MaterialPageRoute(builder: (_) => page),
                      );
                    } else {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => page),
                      );
                    }
                  },
                  onOpenMissions: () => onSectionSelected('Misiones'),
                ),
                const SizedBox(height: 18),
                Expanded(
                  child: SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        ..._items.map(
                          (item) => _DrawerMenuTile(
                            item: item,
                            isSelected: selectedSection == item.label,
                            onTap: () => onSectionSelected(item.label),
                          ),
                        ),
                        _DrawerMenuTile(
                          item: const _HomeMenuItem(
                            'Configuración',
                            Icons.settings_rounded,
                          ),
                          isSelected: false,
                          onTap: () {
                            Navigator.of(context).pop();
                            // Root navigator: Configuración tapa el menú inferior.
                            Navigator.of(context, rootNavigator: true).push(
                              MaterialPageRoute(
                                builder: (_) =>
                                    SettingsPage(authService: authService),
                              ),
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: () => _confirmSignOut(context, authService),
                  icon: const Icon(Icons.logout_rounded),
                  label: Text(tr('auth.signOut')),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: BorderSide(
                      color: Colors.white.withValues(alpha: 0.14),
                    ),
                    minimumSize: const Size.fromHeight(48),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _DrawerHeader extends StatelessWidget {
  const _DrawerHeader({
    required this.user,
    required this.session,
    required this.onOpenProfile,
    required this.onOpenMissions,
  });

  final ApiUser user;
  final AuthSession session;
  final VoidCallback onOpenProfile;
  final VoidCallback onOpenMissions;

  @override
  Widget build(BuildContext context) {
    final displayName = user.name;
    final subtitle = user.username.isNotEmpty
        ? '@${user.username}'
        : user.email;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(18, 18, 16, 18),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(26)),
          child: Row(
            children: [
              Image.asset(
                'assets/icons/logo-votos.png',
                width: 70,
                height: 56,
                fit: BoxFit.contain,
              ),
              const SizedBox(width: 5),
              const Expanded(
                child: Text(
                  'Music Mundial VOTING',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    height: 1.02,
                    letterSpacing: 0.2,
                  ),
                ),
              ),
            ],
          ),
        ),
        _DrawerPointsCard(session: session, onTap: onOpenMissions),
        const SizedBox(height: 8),
        Material(
          color: Colors.white.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(18),
          child: InkWell(
            onTap: onOpenProfile,
            borderRadius: BorderRadius.circular(18),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.08),
                ),
              ),
              child: Row(
                children: [
                  _UserAvatar(user: user, name: displayName),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          displayName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          subtitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Color(0xFFD8D3F7),
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    Icons.chevron_right_rounded,
                    color: Colors.white.withValues(alpha: 0.45),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _DrawerPointsCard extends StatelessWidget {
  const _DrawerPointsCard({
    required this.session,
    required this.onTap,
  });

  final AuthSession session;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: session,
      builder: (context, _) {
        final points = session.user?.points ?? 0;
        return Material(
          color: Colors.white.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(18),
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(18),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.08),
                ),
              ),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: const LinearGradient(
                        colors: [Color(0xFF8B5CF6), Color(0xFFFF21C8)],
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFFFF21C8).withValues(alpha: 0.25),
                          blurRadius: 20,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: const Padding(
                      padding: EdgeInsets.all(2),
                      child: CircleAvatar(
                        backgroundColor: Color(0xFF0B071C),
                        child: Icon(
                          Icons.bolt_rounded,
                          color: Color(0xFFFDE68A),
                          size: 22,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${formatPoints(points)} pts',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          tr('auth.howToEarnPoints'),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Color(0xFFD8D3F7),
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    Icons.chevron_right_rounded,
                    color: Colors.white.withValues(alpha: 0.45),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _UserAvatar extends StatelessWidget {
  const _UserAvatar({required this.user, required this.name});

  final ApiUser user;
  final String name;

  @override
  Widget build(BuildContext context) {
    final photoUrl = user.photoUrl;
    final initial = name.trim().isEmpty ? 'U' : name.trim()[0].toUpperCase();

    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const LinearGradient(
          colors: [Color(0xFF8B5CF6), Color(0xFFFF21C8)],
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFFF21C8).withValues(alpha: 0.25),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(2),
        child: CircleAvatar(
          backgroundColor: const Color(0xFF0B071C),
          backgroundImage: photoUrl == null ? null : NetworkImage(photoUrl),
          child: photoUrl == null
              ? Text(
                  initial,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                  ),
                )
              : null,
        ),
      ),
    );
  }
}

class _DrawerMenuTile extends StatelessWidget {
  const _DrawerMenuTile({
    required this.item,
    required this.isSelected,
    required this.onTap,
  });

  final _HomeMenuItem item;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: isSelected
            ? const Color(0xFF8B5CF6).withValues(alpha: 0.22)
            : Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            child: Row(
              children: [
                Icon(
                  item.icon,
                  color: isSelected ? const Color(0xFFFF4FD8) : Colors.white70,
                  size: 22,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    _sectionTitle(item.label),
                    style: TextStyle(
                      color: isSelected
                          ? Colors.white
                          : const Color(0xFFD8D3F7),
                      fontWeight: isSelected
                          ? FontWeight.w900
                          : FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _HomeMenuItem {
  const _HomeMenuItem(this.label, this.icon);

  final String label;
  final IconData icon;
}

Future<void> _confirmSignOut(
  BuildContext context,
  AuthService authService,
) async {
  final shouldSignOut = await showDialog<bool>(
    context: context,
    barrierColor: Colors.black.withValues(alpha: 0.72),
    builder: (context) {
      return Dialog(
        insetPadding: const EdgeInsets.symmetric(horizontal: 26),
        backgroundColor: Colors.transparent,
        child: Container(
          padding: const EdgeInsets.all(1),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(30),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Colors.white.withValues(alpha: 0.22),
                const Color(0xFFFF21C8).withValues(alpha: 0.22),
                const Color(0xFF7C3AED).withValues(alpha: 0.18),
              ],
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFFFF21C8).withValues(alpha: 0.26),
                blurRadius: 38,
                offset: const Offset(0, 18),
              ),
            ],
          ),
          child: Container(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 22),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(29),
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF120B2B), Color(0xFF080416)],
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 58,
                  height: 58,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: const LinearGradient(
                      colors: [Color(0xFF7C3AED), Color(0xFFFF21C8)],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFFFF21C8).withValues(alpha: 0.28),
                        blurRadius: 24,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.logout_rounded,
                    color: Colors.white,
                    size: 28,
                  ),
                ),
                const SizedBox(height: 18),
                Text(
                  tr('auth.signOut'),
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.4,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  tr('auth.signOutConfirm'),
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Color(0xFFD8D3F7),
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: TextButton(
                        onPressed: () => Navigator.of(context).pop(false),
                        style: TextButton.styleFrom(
                          foregroundColor: const Color(0xFFC084FC),
                          minimumSize: const Size.fromHeight(50),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                          textStyle: const TextStyle(
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        child: Text(tr('auth.cancel')),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFF7C3AED), Color(0xFFFF21C8)],
                          ),
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(
                                0xFFFF21C8,
                              ).withValues(alpha: 0.25),
                              blurRadius: 18,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: FilledButton(
                          onPressed: () => Navigator.of(context).pop(true),
                          style: FilledButton.styleFrom(
                            backgroundColor: Colors.transparent,
                            shadowColor: Colors.transparent,
                            foregroundColor: Colors.white,
                            minimumSize: const Size.fromHeight(50),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                            textStyle: const TextStyle(
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          child: Text(tr('auth.signOutYes')),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      );
    },
  );

  if (shouldSignOut == true) {
    await authService.signOut();
  }
}

class _HomeBackground extends StatelessWidget {
  const _HomeBackground({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: double.infinity,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF050213), Color(0xFF09061B), Color(0xFF120A2B)],
        ),
      ),
      child: child,
    );
  }
}
