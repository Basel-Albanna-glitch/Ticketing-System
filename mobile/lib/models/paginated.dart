/// DRF PageNumberPagination envelope: {count, next, previous, results}.
/// PAGE_SIZE is 10 (backend/config/settings.py:175).
class Paginated<T> {
  final int count;
  final String? next;
  final String? previous;
  final List<T> results;

  const Paginated({
    required this.count,
    required this.results,
    this.next,
    this.previous,
  });

  bool get hasMore => next != null;

  factory Paginated.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) parse,
  ) {
    final rows = (json['results'] as List? ?? const [])
        .cast<Map<String, dynamic>>()
        .map(parse)
        .toList();
    return Paginated(
      count: json['count'] as int? ?? rows.length,
      next: json['next'] as String?,
      previous: json['previous'] as String?,
      results: rows,
    );
  }

  /// Some endpoints opt out of pagination (e.g. the calendar action), so a bare
  /// list is also accepted and treated as a single full page.
  factory Paginated.fromAny(
    dynamic json,
    T Function(Map<String, dynamic>) parse,
  ) {
    if (json is List) {
      final rows = json.cast<Map<String, dynamic>>().map(parse).toList();
      return Paginated(count: rows.length, results: rows);
    }
    return Paginated.fromJson(json as Map<String, dynamic>, parse);
  }
}
