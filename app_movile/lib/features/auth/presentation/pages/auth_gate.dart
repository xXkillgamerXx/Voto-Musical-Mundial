import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../../../artists/presentation/pages/artists_page.dart';
import 'login_page.dart';

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: _HomeBackground(
              child: Center(child: CircularProgressIndicator()),
            ),
          );
        }

        final user = snapshot.data;

        if (user == null) {
          return const LoginPage();
        }

        return _SignedInPage(user: user);
      },
    );
  }
}

class _SignedInPage extends StatefulWidget {
  const _SignedInPage({required this.user});

  final User user;

  @override
  State<_SignedInPage> createState() => _SignedInPageState();
}

class _SignedInPageState extends State<_SignedInPage> {
  late final PageController _pageController;
  String _selectedSection = 'Artistas';

  static const _tabSections = [
    'Inicio',
    'Votaciones',
    'Artistas',
    'Ranking Popularity',
  ];

  int get _selectedTabIndex => _tabSections.indexOf(_selectedSection);

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: _selectedTabIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final displayName = widget.user.displayName?.trim();

    return _HomeBackground(
      child: Scaffold(
        extendBody: true,
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          scrolledUnderElevation: 0,
          surfaceTintColor: Colors.transparent,
          foregroundColor: Colors.white,
          leading: Builder(
            builder: (context) {
              return IconButton(
                tooltip: 'Abrir menú',
                onPressed: () => Scaffold.of(context).openDrawer(),
                icon: const Icon(Icons.menu_rounded),
              );
            },
          ),
          centerTitle: true,
          title:
              (_selectedSection == 'Inicio' || _selectedSection == 'Artistas')
              ? Image.asset(
                  'assets/icons/logo-votos.png',
                  width: 54,
                  height: 42,
                  fit: BoxFit.contain,
                )
              : (_selectedTabIndex == -1 ? Text(_selectedSection) : null),
        ),
        drawer: _HomeMenuDrawer(
          user: widget.user,
          selectedSection: _selectedSection,
          onSectionSelected: (section) {
            _selectSection(section);
            Navigator.of(context).pop();
          },
        ),
        body: _buildSectionContent(displayName),
        bottomNavigationBar: _HomeBottomNav(
          selectedSection: _selectedSection,
          onSectionSelected: _selectSection,
        ),
      ),
    );
  }

  void _selectSection(String section) {
    final tabIndex = _tabSections.indexOf(section);

    setState(() => _selectedSection = section);

    if (tabIndex != -1 && _pageController.hasClients) {
      _pageController.animateToPage(
        tabIndex,
        duration: const Duration(milliseconds: 240),
        curve: Curves.easeOutCubic,
      );
    }
  }

  Widget _buildSectionContent(String? displayName) {
    final tabIndex = _selectedTabIndex;

    if (tabIndex == -1) {
      return _PlaceholderPanel(
        title: _selectedSection,
        subtitle: 'Esta sección se conectará como pantalla completa.',
      );
    }

    return PageView(
      controller: _pageController,
      onPageChanged: (index) {
        setState(() => _selectedSection = _tabSections[index]);
      },
      children: [
        KeepAlivePanel(
          child: _HomePanel(displayName: displayName ?? widget.user.email),
        ),
        const KeepAlivePanel(
          child: _PlaceholderPanel(
            title: 'Votaciones',
            subtitle: 'Aquí irán las votaciones disponibles.',
          ),
        ),
        const KeepAlivePanel(child: ArtistsPage()),
        const KeepAlivePanel(
          child: _PlaceholderPanel(
            title: 'Ranking Popularity',
            subtitle: 'Aquí irá el ranking de popularidad.',
          ),
        ),
      ],
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

class _HomePanel extends StatelessWidget {
  const _HomePanel({required this.displayName});

  final String? displayName;

  @override
  Widget build(BuildContext context) {
    return SizedBox.expand(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Image.asset(
                'assets/icons/logo-votos.png',
                width: 132,
                height: 132,
                fit: BoxFit.contain,
              ),
              const SizedBox(height: 18),
              Text(
                displayName?.isNotEmpty == true
                    ? displayName!
                    : 'Usuario conectado',
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
    _HomeMenuItem('Ranking', Icons.leaderboard_rounded),
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
              final isSelected =
                  selectedSection == item.label ||
                  (item.label == 'Ranking' &&
                      selectedSection == 'Ranking Popularity');

              return Expanded(
                child: _BottomNavButton(
                  item: item,
                  isSelected: isSelected,
                  onTap: () => onSectionSelected(
                    item.label == 'Ranking' ? 'Ranking Popularity' : item.label,
                  ),
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
                item.label,
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
    required this.selectedSection,
    required this.onSectionSelected,
  });

  final User user;
  final String selectedSection;
  final ValueChanged<String> onSectionSelected;

  static const _items = [
    _HomeMenuItem('Inicio', Icons.home_rounded),
    _HomeMenuItem('Votaciones', Icons.how_to_vote_rounded),
    _HomeMenuItem('Artistas', Icons.star_rounded),
    _HomeMenuItem('Ranking Popularity', Icons.leaderboard_rounded),
    _HomeMenuItem('Salón de la fama', Icons.workspace_premium_rounded),
    _HomeMenuItem('Noticias', Icons.article_rounded),
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
                _DrawerHeader(user: user),
                const SizedBox(height: 18),
                ..._items.map(
                  (item) => _DrawerMenuTile(
                    item: item,
                    isSelected: selectedSection == item.label,
                    onTap: () => onSectionSelected(item.label),
                  ),
                ),
                const Spacer(),
                OutlinedButton.icon(
                  onPressed: () => _confirmSignOut(context),
                  icon: const Icon(Icons.logout_rounded),
                  label: const Text('Cerrar sesión'),
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
  const _DrawerHeader({required this.user});

  final User user;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('users')
          .doc(user.uid)
          .snapshots(),
      builder: (context, snapshot) {
        final data = snapshot.data?.data();
        final name = (data?['name'] as String?)?.trim();
        final username = (data?['username'] as String?)?.trim();
        final displayName = name?.isNotEmpty == true
            ? name!
            : user.displayName?.trim().isNotEmpty == true
            ? user.displayName!.trim()
            : 'Usuario fan';
        final subtitle = username?.isNotEmpty == true
            ? '@$username'
            : user.email ?? 'Cuenta fan';

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.fromLTRB(18, 18, 16, 18),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(26),
              ),
              child: Row(
                children: [
                  Image.asset(
                    'assets/icons/logo-votos.png',
                    width: 78,
                    height: 56,
                    fit: BoxFit.contain,
                  ),
                  const SizedBox(width: 14),
                  const Expanded(
                    child: Text(
                      'VOTOS MUSICA\nMUNDIAL',
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

            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
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
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

class _UserAvatar extends StatelessWidget {
  const _UserAvatar({required this.user, required this.name});

  final User user;
  final String name;

  @override
  Widget build(BuildContext context) {
    final photoUrl = user.photoURL;
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
                    item.label,
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

Future<void> _confirmSignOut(BuildContext context) async {
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
                const Text(
                  'Cerrar sesión',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.4,
                  ),
                ),
                const SizedBox(height: 10),
                const Text(
                  '¿Seguro que quieres salir de tu cuenta?',
                  textAlign: TextAlign.center,
                  style: TextStyle(
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
                        child: const Text('Cancelar'),
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
                          child: const Text('Sí, salir'),
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
    await FirebaseAuth.instance.signOut();
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
