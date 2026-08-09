import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api_client.dart';
import '../models/ticket.dart';
import 'providers.dart';

class TicketFilter {
  final String? status;
  final String? priority;
  final String search;
  final bool mineOnly;

  const TicketFilter({
    this.status,
    this.priority,
    this.search = '',
    this.mineOnly = false,
  });

  TicketFilter copyWith({
    String? status,
    String? priority,
    String? search,
    bool? mineOnly,
    bool clearStatus = false,
    bool clearPriority = false,
  }) =>
      TicketFilter(
        status: clearStatus ? null : (status ?? this.status),
        priority: clearPriority ? null : (priority ?? this.priority),
        search: search ?? this.search,
        mineOnly: mineOnly ?? this.mineOnly,
      );
}

class TicketListState {
  final List<Ticket> tickets;
  final TicketFilter filter;
  final bool loading;
  final bool loadingMore;
  final bool hasMore;
  final int total;
  final String? error;

  const TicketListState({
    this.tickets = const [],
    this.filter = const TicketFilter(),
    this.loading = true,
    this.loadingMore = false,
    this.hasMore = false,
    this.total = 0,
    this.error,
  });

  TicketListState copyWith({
    List<Ticket>? tickets,
    TicketFilter? filter,
    bool? loading,
    bool? loadingMore,
    bool? hasMore,
    int? total,
    String? error,
    bool clearError = false,
  }) =>
      TicketListState(
        tickets: tickets ?? this.tickets,
        filter: filter ?? this.filter,
        loading: loading ?? this.loading,
        loadingMore: loadingMore ?? this.loadingMore,
        hasMore: hasMore ?? this.hasMore,
        total: total ?? this.total,
        error: clearError ? null : (error ?? this.error),
      );
}

/// Pages through /api/tickets/ 10 rows at a time (DRF PAGE_SIZE).
class TicketListController extends StateNotifier<TicketListState> {
  final Ref ref;
  int _page = 1;

  TicketListController(this.ref) : super(const TicketListState()) {
    refresh();
  }

  Future<void> refresh() async {
    _page = 1;
    state = state.copyWith(loading: true, clearError: true);
    try {
      final user = ref.read(authProvider).user;
      final f = state.filter;
      final result = await ref.read(ticketRepositoryProvider).list(
            page: _page,
            status: f.status,
            priority: f.priority,
            search: f.search,
            // "Assigned to me" is a staff-side convenience; a customer's list is
            // already scoped to them by the server.
            assignedAgent: f.mineOnly ? user?.id : null,
          );
      state = state.copyWith(
        tickets: result.results,
        loading: false,
        hasMore: result.hasMore,
        total: result.count,
      );
    } catch (e) {
      state = state.copyWith(loading: false, error: describeError(e));
    }
  }

  Future<void> loadMore() async {
    if (!state.hasMore || state.loadingMore || state.loading) return;
    state = state.copyWith(loadingMore: true);
    try {
      final user = ref.read(authProvider).user;
      final f = state.filter;
      final result = await ref.read(ticketRepositoryProvider).list(
            page: _page + 1,
            status: f.status,
            priority: f.priority,
            search: f.search,
            assignedAgent: f.mineOnly ? user?.id : null,
          );
      _page += 1;
      state = state.copyWith(
        tickets: [...state.tickets, ...result.results],
        loadingMore: false,
        hasMore: result.hasMore,
        total: result.count,
      );
    } catch (e) {
      state = state.copyWith(loadingMore: false, error: describeError(e));
    }
  }

  void setFilter(TicketFilter filter) {
    state = state.copyWith(filter: filter);
    refresh();
  }
}

final ticketListProvider =
    StateNotifierProvider<TicketListController, TicketListState>(
  (ref) => TicketListController(ref),
);

/// Detail is fetched per ticket and invalidated after any mutation so the list
/// and the detail view cannot drift apart.
final ticketDetailProvider = FutureProvider.family<Ticket, int>(
  (ref, id) => ref.watch(ticketRepositoryProvider).detail(id),
);
