import '../models/ticket.dart';

/// Categories nest one level deep in practice (Software → Printer), and the
/// pickers present that as two dependent dropdowns rather than one indented
/// list: parents first, then the children of whichever parent was chosen.

/// Top-level categories, in server order (`Category.Meta.ordering = ['name']`).
///
/// A category whose parent is missing from the list is treated as top-level, so
/// it stays selectable rather than disappearing.
List<Category> rootCategories(List<Category> categories) {
  final ids = categories.map((c) => c.id).toSet();
  return categories
      .where((c) => c.parentId == null || !ids.contains(c.parentId))
      .toList();
}

/// Direct children of [parentId]. Empty when the category is a leaf, which is
/// what hides the sub-category dropdown.
List<Category> childrenOf(List<Category> categories, int? parentId) {
  if (parentId == null) return const [];
  return categories.where((c) => c.parentId == parentId).toList();
}
