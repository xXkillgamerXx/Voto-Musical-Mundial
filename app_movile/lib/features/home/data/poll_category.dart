import 'poll.dart';

class PollCategoryItem {
  const PollCategoryItem({
    required this.id,
    required this.name,
    required this.year,
    required this.iconLabel,
    required this.gradientIndex,
  });

  final String id;
  final String name;
  final int year;
  final String iconLabel;
  final int gradientIndex;
}

const _fallbackIcons = ['⭐', '👑', '🏆', '🎤', '❤️', '🔥', '⚡'];

List<PollCategoryItem> extractCategoriesFromPolls(List<Poll> polls) {
  final categoriesById = <String, PollCategoryItem>{};
  var iconIndex = 0;

  for (final poll in polls) {
    final categoryId = poll.categoryId.isNotEmpty
        ? poll.categoryId
        : poll.categoryName;
    if (categoryId.isEmpty || categoriesById.containsKey(categoryId)) {
      continue;
    }

    categoriesById[categoryId] = PollCategoryItem(
      id: categoryId,
      name: poll.categoryName.isNotEmpty ? poll.categoryName : 'Categoría',
      year: poll.year,
      iconLabel: poll.categoryIcon.isNotEmpty
          ? poll.categoryIcon
          : _fallbackIcons[iconIndex % _fallbackIcons.length],
      gradientIndex: iconIndex % 6,
    );
    iconIndex++;
  }

  final rows = categoriesById.values.toList(growable: false)
    ..sort((current, next) {
      final yearCompare = next.year.compareTo(current.year);
      if (yearCompare != 0) {
        return yearCompare;
      }

      return current.name.compareTo(next.name);
    });

  return rows.take(10).toList(growable: false);
}
