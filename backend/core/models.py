from django.db import models

# The permissions an admin may hand out. Named once here because two models carry
# them: TicketSettings (the site-wide fallback for agents without a role) and
# StaffRole (a named bundle assigned to a specific person). If the two ever drifted
# apart, a permission would silently resolve differently depending on whether the
# user happened to have a role, so both inherit the same abstract definition and
# code iterates PERMISSION_FLAGS rather than listing fields by hand.
PERMISSION_FLAGS = (
    'allow_agent_self_assign',
    'allow_agent_reassign',
    'allow_agent_edit_after_close',
    'allow_agent_edit_customers',
    'allow_agent_create_customers',
    'allow_agent_delete',
    'allow_agent_link_customer',
    'allow_agent_manage_kb',
    'allow_agent_assign_projects',
    'allow_agent_unassign_projects',
    'allow_agent_assign_tasks',
    'allow_agent_view_reports',
    'allow_agent_view_tickets',
    'allow_agent_view_customers',
    'allow_agent_view_projects',
    'allow_agent_customize_columns',
)

# Section-visibility flags. These differ from the rest in defaulting to True:
# the others grant an extra ability nobody had, while these withhold access
# staff already have, so off-by-default would cut every existing agent off
# from the app the moment this shipped. A new role also starts with them on,
# so creating a role to grant one small permission never silently hides the
# main sections from whoever holds it.
DEFAULT_ON_FLAGS = frozenset({
    'allow_agent_view_tickets',
    'allow_agent_view_customers',
    'allow_agent_view_projects',
})

# Columns of the ticket table, in display order. A role (or, for agents without
# one, TicketSettings) can withhold any of them; each person may then hide more
# for themselves but never show one they were denied — see
# User.allowed_ticket_columns. Mirrored by frontend/src/constants/ticketColumns.js.
TICKET_COLUMNS = (
    'created_at',
    'start_date',
    'assigned_at',
    'closed_at',
    'id',
    'subject',
    'customer',
    'parent_category',
    'sub_category',
    'requested_priority',
    'customer_priority',
    'predefined_priority',
    'status',
    'assigned_agent',
)

# Customers hold no role. Always kept from them: who a ticket is assigned to, which the
# table withheld from them before columns were configurable, and the priority staff
# give the customer themselves.
CUSTOMER_WITHHELD_TICKET_COLUMNS = frozenset(
    {'assigned_at', 'assigned_agent', 'customer_priority'}
)


class AgentPermissionFlags(models.Model):
    """The grantable permissions, shared by TicketSettings and StaffRole.

    Every flag defaults to False: a new role starts with no privileges and is
    opened up deliberately, rather than granting something nobody intended.
    """

    allow_agent_self_assign = models.BooleanField(default=False)
    allow_agent_reassign = models.BooleanField(default=False)
    # A closed ticket is locked (no status/deadline/comment changes) for everyone
    # except admins, who can always reopen it. When this is on, agents who may normally
    # edit the ticket can also keep editing it after it's closed; customers never can.
    allow_agent_edit_after_close = models.BooleanField(default=False)
    # When on, agents may edit customer records. Deleting a customer always stays
    # admin-only.
    allow_agent_edit_customers = models.BooleanField(default=False)
    # When on, agents may create customer records too. Deleting a customer always
    # stays admin-only — an accidental create is easy to fix, a delete is not.
    allow_agent_create_customers = models.BooleanField(default=False)
    # When on, the agent a ticket is assigned to may delete it. When off, only admins can.
    allow_agent_delete = models.BooleanField(default=False)
    # When on, agents may link, change, or remove the customer on a guest ticket.
    allow_agent_link_customer = models.BooleanField(default=False)
    # When on, agents may create, edit, and delete knowledge-base articles. When off,
    # managing the knowledge base stays admin-only.
    allow_agent_manage_kb = models.BooleanField(default=False)
    # When on, agents may change who a project or one of its tasks is assigned to.
    # When off, only admins can — an agent can still see and work the assignment,
    # just not hand it to someone else.
    allow_agent_assign_projects = models.BooleanField(default=False)
    # When on, an agent may step off a project they are assigned to. When off,
    # they can still take unclaimed work on — they just cannot drop it again
    # without an admin, so work is never quietly abandoned.
    allow_agent_unassign_projects = models.BooleanField(default=False)
    # Task-level assignment, kept separate from the project-level switch: a team
    # can be trusted to divide work between themselves inside a project without
    # also being able to hand the whole project to someone else.
    allow_agent_assign_tasks = models.BooleanField(default=False)
    # When on, agents may open the Reports area and export from it. Reports
    # aggregate across every customer and agent, so this stays off by default —
    # it is a far wider view than the tickets an agent works day to day.
    allow_agent_view_reports = models.BooleanField(default=False)
    # Section visibility — see DEFAULT_ON_FLAGS above for why these default True.
    # Customers are never governed by these: their own tickets and their own
    # profile stay visible regardless, which is all they can reach anyway.
    allow_agent_view_tickets = models.BooleanField(default=True)
    allow_agent_view_customers = models.BooleanField(default=True)
    allow_agent_view_projects = models.BooleanField(default=True)
    # When on, agents may hide and show ticket-table columns for themselves, among the
    # columns withheld_ticket_columns leaves them. When off they see every column they
    # are allowed. It grants a choice rather than withholding access, so it starts off.
    allow_agent_customize_columns = models.BooleanField(default=False)
    # Ticket-table columns withheld from whoever this applies to (keys from
    # TICKET_COLUMNS). A deny-list rather than an allow-list for the same reason the
    # section flags default on: an empty list keeps every column, so upgrading hides
    # nothing, and a column added later appears for existing roles instead of silently
    # going missing from them.
    withheld_ticket_columns = models.JSONField(default=list, blank=True)

    class Meta:
        abstract = True

    def permission_map(self):
        """The flags as a plain dict, for serializing to the client."""
        return {flag: getattr(self, flag) for flag in PERMISSION_FLAGS}
