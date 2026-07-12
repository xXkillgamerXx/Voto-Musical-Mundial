import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/widgets/skeleton_box.dart';
import '../../data/news_api.dart';
import '../widgets/news_card.dart';

class NewsScreen extends StatelessWidget {
  const NewsScreen({super.key});

  static Future<void> open(BuildContext context) {
    return Navigator.of(context).push<void>(
      MaterialPageRoute(builder: (_) => const NewsScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF050213), Color(0xFF09061B), Color(0xFF120A2B)],
        ),
      ),
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          scrolledUnderElevation: 0,
          surfaceTintColor: Colors.transparent,
          foregroundColor: Colors.white,
          centerTitle: true,
          title: const Text(
            'Noticias',
            style: TextStyle(fontWeight: FontWeight.w900),
          ),
        ),
        body: const NewsPage(),
      ),
    );
  }
}

class NewsPage extends StatefulWidget {
  const NewsPage({super.key});

  @override
  State<NewsPage> createState() => _NewsPageState();
}

class _NewsPageState extends State<NewsPage> {
  static const _batchSize = 10;

  final _newsApi = NewsApi();
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();
  Timer? _searchDebounce;

  String _searchQuery = '';
  int _apiPage = 0;
  int _totalAvailable = 0;
  bool _hasMore = true;
  bool _initialLoading = true;
  bool _loadingMore = false;
  String? _errorMessage;
  List<NewsItem> _items = const [];

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _loadInitial();
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scrollController.hasClients || _initialLoading || _loadingMore) {
      return;
    }

    if (!_hasMore) {
      return;
    }

    final position = _scrollController.position;
    if (position.pixels >= position.maxScrollExtent - 280) {
      _loadMore();
    }
  }

  Future<void> _loadInitial() async {
    setState(() {
      _initialLoading = true;
      _loadingMore = false;
      _errorMessage = null;
      _items = const [];
      _apiPage = 0;
      _hasMore = true;
      _totalAvailable = 0;
    });

    try {
      final result = await _newsApi.fetchNewsPage(
        page: 1,
        perPage: _batchSize,
        search: _searchQuery,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _items = result.items;
        _apiPage = 1;
        _totalAvailable = result.total;
        _hasMore = _apiPage < result.totalPages;
        _initialLoading = false;
      });
    } on NewsApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _errorMessage = error.message;
        _initialLoading = false;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _errorMessage = 'No se pudieron cargar las noticias.';
        _initialLoading = false;
      });
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMore || _initialLoading) {
      return;
    }

    setState(() => _loadingMore = true);

    try {
      final nextPage = _apiPage + 1;
      final result = await _newsApi.fetchNewsPage(
        page: nextPage,
        perPage: _batchSize,
        search: _searchQuery,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _items = [..._items, ...result.items];
        _apiPage = nextPage;
        _totalAvailable = result.total;
        _hasMore = _apiPage < result.totalPages;
        _loadingMore = false;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() => _loadingMore = false);
    }
  }

  void _onSearchChanged(String value) {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 450), () {
      final nextQuery = value.trim();
      if (nextQuery == _searchQuery) {
        return;
      }

      _searchQuery = nextQuery;
      if (_scrollController.hasClients) {
        _scrollController.jumpTo(0);
      }
      _loadInitial();
    });
  }

  void _clearSearch() {
    _searchDebounce?.cancel();
    _searchController.clear();
    if (_searchQuery.isEmpty) {
      return;
    }

    _searchQuery = '';
    if (_scrollController.hasClients) {
      _scrollController.jumpTo(0);
    }
    _loadInitial();
  }

  Future<void> _openArticle(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) {
      return;
    }

    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    if (_initialLoading && _items.isEmpty && _errorMessage == null) {
      return const NewsLoadingView();
    }

    return Container(
      margin: const EdgeInsets.fromLTRB(18, 0, 18, 0),
      child: CustomScrollView(
        controller: _scrollController,
        slivers: [
          SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 10),
                Text(
                  'Noticias',
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Últimas noticias de música y entretenimiento cargadas desde el feed oficial de Music Mundial.',
                  style: TextStyle(
                    color: Color(0xFFB9B2D8),
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 16),
              ],
            ),
          ),
          SliverPersistentHeader(
            pinned: true,
            delegate: _NewsSearchHeader(
              controller: _searchController,
              total: _totalAvailable,
              loaded: _items.length,
              loading: _initialLoading,
              onChanged: _onSearchChanged,
              onClear: _searchQuery.isEmpty ? null : _clearSearch,
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 16)),
          if (_errorMessage != null)
            SliverFillRemaining(
              hasScrollBody: false,
              child: _NewsStateMessage(
                icon: Icons.error_outline_rounded,
                title: _errorMessage!,
              ),
            )
          else if (_items.isEmpty)
            const SliverFillRemaining(
              hasScrollBody: false,
              child: _NewsStateMessage(
                icon: Icons.article_outlined,
                title: 'No encontramos noticias para tu búsqueda.',
              ),
            )
          else ...[
            SliverList.separated(
              itemCount: _items.length,
              separatorBuilder: (_, _) => const SizedBox(height: 14),
              itemBuilder: (context, index) {
                final item = _items[index];
                return NewsCard(
                  item: item,
                  onTap: () => _openArticle(item.link),
                );
              },
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 20),
                child: _NewsScrollFooter(
                  loadingMore: _loadingMore,
                  hasMore: _hasMore,
                  loaded: _items.length,
                  total: _totalAvailable,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _NewsSearchField extends StatelessWidget {
  const _NewsSearchField({
    required this.controller,
    required this.onChanged,
    required this.onClear,
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      onChanged: onChanged,
      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
      decoration: InputDecoration(
        labelText: 'Buscar noticias',
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        prefixIcon: const Icon(Icons.search_rounded, size: 22),
        prefixIconConstraints: const BoxConstraints(minWidth: 44),
        suffixIcon: onClear == null
            ? null
            : IconButton(
                onPressed: onClear,
                icon: const Icon(Icons.close_rounded, size: 20),
              ),
      ),
    );
  }
}

class _NewsSearchHeader extends SliverPersistentHeaderDelegate {
  const _NewsSearchHeader({
    required this.controller,
    required this.total,
    required this.loaded,
    required this.loading,
    required this.onChanged,
    required this.onClear,
  });

  final TextEditingController controller;
  final int total;
  final int loaded;
  final bool loading;
  final ValueChanged<String> onChanged;
  final VoidCallback? onClear;

  @override
  double get minExtent => 80;

  @override
  double get maxExtent => 80;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    final countLabel = loading && total == 0
        ? 'Cargando noticias...'
        : total == 0
        ? '0 noticias disponibles'
        : loaded >= total
        ? '$total noticias disponibles'
        : 'Mostrando $loaded de $total noticias';

    return Container(
      padding: const EdgeInsets.only(top: 2, bottom: 2),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF050213), Color(0xFF09061B)],
        ),
        boxShadow: overlapsContent
            ? [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.35),
                  blurRadius: 18,
                  offset: const Offset(0, 10),
                ),
              ]
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _NewsSearchField(
            controller: controller,
            onChanged: onChanged,
            onClear: onClear,
          ),
          const SizedBox(height: 5),
          Text(
            countLabel,
            style: const TextStyle(
              color: Color(0xFF8E86B9),
              fontSize: 11,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }

  @override
  bool shouldRebuild(covariant _NewsSearchHeader oldDelegate) {
    return controller != oldDelegate.controller ||
        total != oldDelegate.total ||
        loaded != oldDelegate.loaded ||
        loading != oldDelegate.loading ||
        onClear != oldDelegate.onClear;
  }
}

class _NewsScrollFooter extends StatelessWidget {
  const _NewsScrollFooter({
    required this.loadingMore,
    required this.hasMore,
    required this.loaded,
    required this.total,
  });

  final bool loadingMore;
  final bool hasMore;
  final int loaded;
  final int total;

  @override
  Widget build(BuildContext context) {
    if (loadingMore) {
      return const Center(
        child: SizedBox(
          width: 28,
          height: 28,
          child: CircularProgressIndicator(strokeWidth: 2.6),
        ),
      );
    }

    if (!hasMore && loaded > 0) {
      return Text(
        'Has visto las $loaded noticias${total > loaded ? ' de $total' : ''}.',
        textAlign: TextAlign.center,
        style: TextStyle(
          color: Colors.white.withValues(alpha: 0.45),
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      );
    }

    return Text(
      'Desliza hacia abajo para cargar más',
      textAlign: TextAlign.center,
      style: TextStyle(
        color: Colors.white.withValues(alpha: 0.35),
        fontSize: 12,
        fontWeight: FontWeight.w700,
      ),
    );
  }
}

class _NewsStateMessage extends StatelessWidget {
  const _NewsStateMessage({required this.icon, required this.title});

  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: const Color(0xFF8E86B9), size: 42),
            const SizedBox(height: 12),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Color(0xFFCBD5E1),
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
