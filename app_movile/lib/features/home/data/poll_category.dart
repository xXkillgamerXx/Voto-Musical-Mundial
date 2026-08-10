import 'poll.dart';

class PollCategoryItem {
  const PollCategoryItem({
    required this.id,
    required this.name,
    required this.year,
    required this.iconLabel,
    required this.gradientIndex,
    required this.pollCount,
  });

  final String id;
  final String name;
  final int year;
  final String iconLabel;
  final int gradientIndex;
  final int pollCount;
}

/// Filtro activo de categoría en la pestaña Votaciones.
class PollsCategoryFilter {
  const PollsCategoryFilter({
    required this.id,
    required this.name,
  });

  final String id;
  final String name;

  bool matches(Poll poll) {
    if (id.isEmpty) return true;
    if (poll.categoryId.isNotEmpty && poll.categoryId == id) return true;
    if (poll.categoryName.isNotEmpty && poll.categoryName == id) return true;
    if (poll.categoryName.isNotEmpty && poll.categoryName == name) return true;
    return false;
  }
}

const _fallbackIcons = ['⭐', '👑', '🏆', '🎤', '❤️', '🔥', '⚡'];

bool _pollHasVotingData(Poll poll) {
  return poll.status == 'live' ||
      poll.status == 'selecting_winners' ||
      poll.status == 'closed';
}

List<PollCategoryItem> extractCategoriesFromPolls(List<Poll> polls) {
  final categoriesById = <String, PollCategoryItem>{};
  final pollCounts = <String, int>{};
  var iconIndex = 0;

  for (final poll in polls) {
    if (!_pollHasVotingData(poll)) continue;

    final categoryId = poll.categoryId.isNotEmpty
        ? poll.categoryId
        : poll.categoryName.trim();
    if (categoryId.isEmpty) continue;

    pollCounts[categoryId] = (pollCounts[categoryId] ?? 0) + 1;

    if (categoriesById.containsKey(categoryId)) continue;

    categoriesById[categoryId] = PollCategoryItem(
      id: categoryId,
      name: poll.categoryName.isNotEmpty ? poll.categoryName : 'Categoría',
      year: poll.year,
      iconLabel: poll.categoryIcon.isNotEmpty
          ? poll.categoryIcon
          : _fallbackIcons[iconIndex % _fallbackIcons.length],
      gradientIndex: iconIndex % 6,
      pollCount: 0,
    );
    iconIndex++;
  }

  final rows = categoriesById.entries
      .map((entry) {
        final count = pollCounts[entry.key] ?? 0;
        if (count <= 0) return null;
        final item = entry.value;
        return PollCategoryItem(
          id: item.id,
          name: item.name,
          year: item.year,
          iconLabel: item.iconLabel,
          gradientIndex: item.gradientIndex,
          pollCount: count,
        );
      })
      .whereType<PollCategoryItem>()
      .toList(growable: false)
    ..sort((current, next) {
      final countCompare = next.pollCount.compareTo(current.pollCount);
      if (countCompare != 0) return countCompare;
      final yearCompare = next.year.compareTo(current.year);
      if (yearCompare != 0) return yearCompare;
      return current.name.compareTo(next.name);
    });

  return rows.take(10).toList(growable: false);
}
