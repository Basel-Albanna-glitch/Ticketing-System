import 'package:flutter/material.dart';

import '../models/project.dart';
import '../models/ticket.dart';
import 'i18n.dart';

/// Translated display labels for the ticket enums.
///
/// These live here rather than on `TicketStatus`/`TicketPriority` because those
/// classes mirror the API and know nothing about Flutter — a static `label()`
/// has no `BuildContext` to resolve a locale from. The wire values themselves
/// never change; only what is drawn does.
///
/// `open` is special: it is a single stored status that reads as "Unassigned"
/// while nobody owns the ticket and "Assigned" once someone does (see
/// DASHBOARD_ASSIGNED in backend/tickets/views.py).
String statusLabel(BuildContext context, String value,
        {bool assigned = false}) =>
    switch (value) {
      TicketStatus.open =>
        context.t(assigned ? 'tickets.assigned' : 'tickets.unassigned'),
      TicketStatus.inProgress => context.t('tickets.status.in_progress'),
      TicketStatus.onHold => context.t('tickets.status.on_hold'),
      TicketStatus.resolved => context.t('tickets.status.resolved'),
      TicketStatus.closed => context.t('tickets.status.closed'),
      // An unrecognised status from a newer backend shows its raw value rather
      // than an empty chip.
      _ => value,
    };

String priorityLabel(BuildContext context, String value) => switch (value) {
      TicketPriority.low => context.t('tickets.priority.low'),
      TicketPriority.medium => context.t('tickets.priority.medium'),
      TicketPriority.high => context.t('tickets.priority.high'),
      TicketPriority.urgent => context.t('tickets.priority.urgent'),
      _ => value,
    };

/// Kanban column labels for the projects board.
String taskStatusLabel(BuildContext context, String value) => switch (value) {
      TaskStatus.todo => context.t('task.todo'),
      TaskStatus.inProgress => context.t('task.in_progress'),
      TaskStatus.inReview => context.t('task.in_review'),
      TaskStatus.done => context.t('task.done'),
      _ => value,
    };

/// "Forward" chevron for the reading direction. IconData does not mirror on its
/// own, so an untreated chevron_right still points right in Arabic and reads as
/// "go back". Widget *positions* (ListTile.trailing, Row order) mirror by
/// themselves; only the glyph needs this.
IconData forwardChevron(BuildContext context) =>
    Directionality.of(context) == TextDirection.rtl
        ? Icons.chevron_left
        : Icons.chevron_right;

/// The reverse, for "previous" affordances such as the calendar's month step.
IconData backChevron(BuildContext context) =>
    Directionality.of(context) == TextDirection.rtl
        ? Icons.chevron_right
        : Icons.chevron_left;
