import '../models/project.dart';
import '../models/ticket.dart';
import '../models/user.dart';

/// What the signed-in user may do to one particular ticket.
///
/// These mirror the server's rules exactly — every one of them is enforced in
/// backend/tickets/views.py, and this class exists only so the UI can hide or
/// disable actions that would be refused. Nothing here is a security boundary;
/// it stops the app from offering buttons that reliably fail.
class TicketPermissions {
  final AppUser? user;
  final Ticket ticket;
  final TicketSettings settings;

  const TicketPermissions({
    required this.user,
    required this.ticket,
    required this.settings,
  });

  bool get isAdmin => user?.isAdmin ?? false;
  bool get isAgent => user?.role == 'agent';
  bool get isStaff => user?.isStaff ?? false;
  bool get isMine => ticket.assignedAgent?.id == user?.id;

  /// A closed ticket is frozen for everyone except admins; agents are included
  /// only when "edit after close" is enabled, and customers never are
  /// (_closed_lock_response).
  bool get closedLock {
    if (!ticket.isClosed) return false;
    if (isAdmin) return false;
    if (isAgent && settings['allow_agent_edit_after_close']) return false;
    return true;
  }

  /// Editing a ticket's own fields: admin, or the agent it is assigned to
  /// (CanEditTicket).
  bool get canEdit => !closedLock && (isAdmin || (isAgent && isMine));

  /// Status cannot move at all until someone owns the ticket
  /// (tickets/views.py: "Assign this ticket to an agent before changing its
  /// status").
  bool get canChangeStatus => canEdit && ticket.isAssigned;

  bool get canSetDeadline => canEdit;

  /// Claiming an unassigned ticket for yourself.
  ///
  /// Only ever offered for a ticket nobody holds — admins included. Taking a
  /// ticket that already has an owner is a *reassignment*, which goes through
  /// the agent picker ([canAssignOthers]) rather than a one-tap button, so the
  /// current owner is never silently displaced. This matches the web, where
  /// `canSelfAssign` requires `assigned_agent === null`.
  bool get canClaim {
    if (closedLock || ticket.isAssigned) return false;
    if (isAdmin) return true;
    return isAgent && settings['allow_agent_self_assign'];
  }

  /// Handing the ticket to a different agent.
  bool get canAssignOthers {
    if (closedLock) return false;
    if (isAdmin) return true;
    if (!isAgent) return false;
    // Agents may reassign only when permitted, and only a ticket of their own.
    return settings['allow_agent_reassign'] && isMine;
  }

  /// Only an admin may remove an assignment — agents cannot release a ticket
  /// once taken, so "Unassigned" is never an option they can reach.
  bool get canUnassign => !closedLock && isAdmin && ticket.isAssigned;

  /// Deleting: admin always; the assigned agent only when allowed.
  bool get canDelete {
    if (closedLock) return false;
    if (isAdmin) return true;
    return isAgent && settings['allow_agent_delete'] && isMine;
  }

  /// Linking or unlinking the customer on a guest ticket.
  bool get canLinkCustomer {
    if (closedLock) return false;
    if (isAdmin) return true;
    return isAgent && settings['allow_agent_link_customer'];
  }

  /// Managing collaborators is admin-only (IsAdmin on set_collaborators).
  bool get canEditCollaborators => !closedLock && isAdmin;

  /// Attaching related knowledge-base articles: any staff member.
  bool get canEditArticles => !closedLock && isStaff;

  /// Logging work phases — staff only, and blocked once frozen.
  bool get canAddPhase => !closedLock && isStaff;

  /// Commenting follows the same close lock as everything else.
  bool get canComment => !closedLock;

  /// Statuses worth offering.
  ///
  /// `open` is dropped once the ticket has an agent: it is the same stored
  /// status the UI calls "Assigned", so choosing it would look like unassigning
  /// while doing nothing. Only an admin can truly unassign, and that is done
  /// through assignment, not status.
  List<String> get selectableStatuses => [
        for (final s in TicketStatus.all)
          if (!(s == TicketStatus.open && ticket.isAssigned)) s,
      ];

  /// Why actions are unavailable, for display. Null when nothing is blocked.
  String? get lockReason {
    if (closedLock) {
      return isAgent
          ? 'This ticket is closed. Ask an admin to reopen it, or enable '
              'editing of closed tickets for agents in Settings.'
          : 'This ticket is closed.';
    }
    if (isStaff && !ticket.isAssigned) {
      return 'Assign this ticket to an agent before changing its status.';
    }
    return null;
  }
}
