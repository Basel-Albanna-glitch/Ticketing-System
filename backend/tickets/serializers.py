import re

from accounts.models import CustomerBranch, User
from accounts.serializers import CustomerBranchSerializer, TicketColumnListField, UserSerializer
from django.utils import timezone
from rest_framework import serializers

from .models import (
    Article,
    ArticleAttachment,
    Attachment,
    Category,
    Comment,
    Ticket,
    TicketActivity,
    TicketPhase,
    TicketSettings,
)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'description', 'priority', 'parent', 'created_at']

    def validate_parent(self, value):
        if value is None or self.instance is None:
            return value
        if value.id == self.instance.id:
            raise serializers.ValidationError("A category can't be its own parent.")
        # Walk up from the proposed parent; if we reach this category, it's a cycle.
        ancestor = value
        while ancestor is not None:
            if ancestor.id == self.instance.id:
                raise serializers.ValidationError(
                    "A category can't be moved under one of its own descendants."
                )
            ancestor = ancestor.parent
        return value


class ArticleAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ArticleAttachment
        fields = ['id', 'file', 'original_filename', 'content_type', 'size', 'created_at']


class ArticleListSerializer(serializers.ModelSerializer):
    """Lightweight article for lists / linked-article chips — no full body."""
    category = CategorySerializer(read_only=True)
    excerpt = serializers.SerializerMethodField()
    attachment_count = serializers.IntegerField(source='attachments.count', read_only=True)

    class Meta:
        model = Article
        fields = [
            'id', 'title', 'excerpt', 'category', 'is_published',
            'attachment_count', 'updated_at',
        ]

    def get_excerpt(self, obj):
        text = ' '.join(obj.body.split())
        return f'{text[:160]}…' if len(text) > 160 else text


class ArticleSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        source='category', queryset=Category.objects.all(),
        write_only=True, required=False, allow_null=True,
    )
    author_name = serializers.SerializerMethodField()
    attachments = ArticleAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Article
        fields = [
            'id', 'title', 'body', 'category', 'category_id',
            'is_published', 'author_name', 'attachments', 'created_at', 'updated_at',
        ]
        read_only_fields = ['author_name', 'created_at', 'updated_at']

    def get_author_name(self, obj):
        return obj.author.full_name if obj.author_id else None


class AttachmentSerializer(serializers.ModelSerializer):
    uploaded_by = UserSerializer(read_only=True)

    class Meta:
        model = Attachment
        fields = [
            'id', 'ticket', 'comment', 'file', 'original_filename',
            'content_type', 'size', 'uploaded_by', 'created_at',
        ]
        read_only_fields = ['ticket', 'comment', 'uploaded_by']


class CommentSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    author_name = serializers.SerializerMethodField()
    attachments = AttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Comment
        fields = ['id', 'ticket', 'author', 'author_name', 'body', 'attachments', 'created_at']
        read_only_fields = ['ticket', 'author']

    def get_author_name(self, obj):
        if obj.author:
            return obj.author.full_name
        return obj.guest_name or 'Guest'


class TicketPhaseSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    author_name = serializers.CharField(source='author.full_name', read_only=True, default='')

    class Meta:
        model = TicketPhase
        fields = ['id', 'author', 'author_name', 'body', 'created_at']
        read_only_fields = ['author']


class TicketActivitySerializer(serializers.ModelSerializer):
    actor = UserSerializer(read_only=True)

    class Meta:
        model = TicketActivity
        fields = ['id', 'actor', 'activity_type', 'description', 'metadata', 'created_at']


class TicketListSerializer(serializers.ModelSerializer):
    customer = UserSerializer(read_only=True)
    assigned_agent = UserSerializer(read_only=True)
    category = CategorySerializer(read_only=True)
    branch = CustomerBranchSerializer(read_only=True)
    reference = serializers.CharField(read_only=True)
    # The admin-set priority actually in force: the ticket's override when it has one,
    # otherwise the category's. Clients display this; they write category_priority_override.
    category_priority = serializers.CharField(
        source='effective_category_priority', read_only=True, allow_null=True
    )
    # The priority staff give the ticket's customer (User.customer_priority), not the
    # ticket's own. Null for guest tickets and for customers nobody has ranked.
    customer_priority = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = [
            'id', 'reference', 'subject', 'customer', 'branch',
            'guest_name', 'guest_company', 'guest_branch', 'guest_phone', 'guest_email',
            'category', 'priority', 'customer_priority', 'category_priority',
            'category_priority_override', 'status',
            'assigned_agent', 'assigned_at', 'start_date', 'due_at', 'created_at',
            'closed_at',
        ]

    def get_customer_priority(self, obj):
        return obj.customer.customer_priority if obj.customer_id else None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Staff's ranking of a customer stays with staff, on their tickets as on their account.
        request = self.context.get('request')
        if request and getattr(request.user, 'role', None) == User.Role.CUSTOMER:
            data.pop('customer_priority', None)
        return data


class TicketCalendarSerializer(serializers.ModelSerializer):
    """Minimal ticket row for the calendar grid — just enough to draw a chip and link it."""

    assigned_agent_name = serializers.CharField(
        source='assigned_agent.full_name', read_only=True, default=''
    )
    assigned_agent_avatar = serializers.SerializerMethodField()
    closed_date = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = [
            'id', 'reference', 'subject', 'priority', 'status',
            'start_date', 'closed_at', 'closed_date',
            'assigned_agent_name', 'assigned_agent_avatar',
        ]

    def get_assigned_agent_avatar(self, obj):
        """Absolute URL of the agent's picture, or null — the chip falls back to initials."""
        avatar = getattr(obj.assigned_agent, 'avatar', None)
        if not avatar:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(avatar.url) if request else avatar.url

    def get_closed_date(self, obj):
        """The day the ticket was closed, or null while it's still open. The calendar shows a
        closed ticket on both days — its start date and this one — so returning it as its own
        field keeps the date arithmetic (and timezone) on the server."""
        if obj.status == Ticket.Status.CLOSED and obj.closed_at:
            return timezone.localtime(obj.closed_at).date().isoformat()
        return None


class TicketDetailSerializer(TicketListSerializer):
    comments = CommentSerializer(many=True, read_only=True)
    phases = TicketPhaseSerializer(many=True, read_only=True)
    attachments = AttachmentSerializer(many=True, read_only=True)
    collaborators = UserSerializer(many=True, read_only=True)
    articles = ArticleListSerializer(many=True, read_only=True)
    # Writable counterpart to the read-only nested `category`, so an admin can change it
    # when editing the ticket's details.
    category_id = serializers.PrimaryKeyRelatedField(
        source='category', queryset=Category.objects.all(), write_only=True, required=False
    )
    # Writable counterpart to the read-only nested `branch`. A branch can otherwise only be
    # set when a guest ticket is first linked to a customer, which left no way to correct a
    # wrong choice. Send null to clear it.
    branch_id = serializers.PrimaryKeyRelatedField(
        source='branch', queryset=CustomerBranch.objects.all(),
        write_only=True, required=False, allow_null=True,
    )

    class Meta(TicketListSerializer.Meta):
        fields = TicketListSerializer.Meta.fields + [
            'description', 'updated_at', 'resolved_at', 'closed_at', 'assigned_at', 'hold_reason',
            'rating', 'rating_comment', 'rating_submitted_at',
            'comments', 'phases', 'attachments', 'collaborators', 'articles', 'category_id',
            'branch_id',
        ]

    def validate_subject(self, value):
        # Must contain at least one letter (any language) — not just numbers or symbols.
        if not re.search(r'[^\W\d_]', value):
            raise serializers.ValidationError(
                'The subject must contain text, not just numbers or symbols.'
            )
        return value

    def validate(self, attrs):
        # A branch belongs to exactly one customer, so it must match the ticket's own
        # customer — otherwise a ticket could be filed against a stranger's branch. The
        # same rule the customer-linking action enforces.
        if 'branch' in attrs:
            branch = attrs['branch']
            customer = attrs.get('customer') or getattr(self.instance, 'customer', None)
            if branch is not None:
                if customer is None:
                    raise serializers.ValidationError(
                        {'branch_id': 'Link a customer before choosing a branch.'}
                    )
                if branch.customer_id != customer.id:
                    raise serializers.ValidationError(
                        {'branch_id': 'Branch does not belong to this customer.'}
                    )
        return super().validate(attrs)


class TicketCollaboratorsSerializer(serializers.ModelSerializer):
    collaborators = serializers.PrimaryKeyRelatedField(
        many=True, queryset=User.objects.filter(role__in=[User.Role.AGENT, User.Role.ADMIN])
    )

    class Meta:
        model = Ticket
        fields = ['collaborators']


class TicketArticlesSerializer(serializers.ModelSerializer):
    articles = serializers.PrimaryKeyRelatedField(many=True, queryset=Article.objects.all())

    class Meta:
        model = Ticket
        fields = ['articles']


class TicketCreateSerializer(serializers.ModelSerializer):
    customer_id = serializers.PrimaryKeyRelatedField(
        source='customer',
        queryset=User.objects.filter(role=User.Role.CUSTOMER),
        required=False,
        write_only=True,
    )
    assigned_agent_id = serializers.PrimaryKeyRelatedField(
        source='assigned_agent',
        # Admins can be assigned too, so they can pick up a ticket themselves.
        queryset=User.objects.filter(role__in=[User.Role.AGENT, User.Role.ADMIN]),
        required=False,
        allow_null=True,
        write_only=True,
    )
    branch_id = serializers.PrimaryKeyRelatedField(
        source='branch',
        queryset=CustomerBranch.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )

    class Meta:
        model = Ticket
        # priority here is the customer's own requested priority; the category also carries
        # its own admin-set priority (Category.priority), shown separately.
        fields = [
            'id', 'subject', 'description', 'category', 'priority', 'customer_id',
            'assigned_agent_id', 'branch_id', 'start_date',
        ]

    def validate(self, attrs):
        # A chosen branch must belong to the ticket's customer.
        branch = attrs.get('branch')
        customer = attrs.get('customer')
        if branch is not None and customer is not None and branch.customer_id != customer.id:
            raise serializers.ValidationError({'branch_id': 'Branch does not belong to this customer.'})
        return attrs

    def validate_subject(self, value):
        # Must contain at least one letter (any language) — not just numbers or symbols.
        if not re.search(r'[^\W\d_]', value):
            raise serializers.ValidationError(
                'The subject must contain text, not just numbers or symbols.'
            )
        return value


class TicketStatusUpdateSerializer(serializers.ModelSerializer):
    hold_reason = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Ticket
        fields = ['status', 'hold_reason']


class TicketDeadlineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ticket
        fields = ['due_at']


class TicketAssignSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ticket
        fields = ['assigned_agent']

    def validate_assigned_agent(self, value):
        if value is not None and value.role not in (User.Role.AGENT, User.Role.ADMIN):
            raise serializers.ValidationError('assigned_agent must be a user with role=agent or role=admin.')
        return value


class TicketSettingsSerializer(serializers.ModelSerializer):
    # Columns withheld from agents who hold no role.
    withheld_ticket_columns = TicketColumnListField(keep_one=True)

    class Meta:
        model = TicketSettings
        fields = [
            'allow_agent_self_assign', 'allow_agent_reassign', 'allow_agent_edit_after_close',
            'allow_agent_edit_customers', 'allow_agent_delete', 'allow_agent_link_customer',
            'allow_agent_manage_kb', 'allow_agent_assign_projects',
            'allow_agent_unassign_projects', 'allow_agent_assign_tasks',
            'allow_agent_create_customers', 'allow_agent_view_reports',
            'allow_agent_customize_columns', 'withheld_ticket_columns',
        ]


class PublicCategorySerializer(serializers.ModelSerializer):
    """Minimal category info for the public guest form (no auth)."""

    class Meta:
        model = Category
        fields = ['id', 'name', 'parent']


class GuestTicketCreateSerializer(serializers.ModelSerializer):
    guest_name = serializers.CharField(max_length=150)
    guest_company = serializers.CharField(max_length=200, required=False, allow_blank=True)
    guest_branch = serializers.CharField(max_length=200, required=False, allow_blank=True)
    guest_phone = serializers.CharField(max_length=30)
    guest_email = serializers.EmailField(required=False, allow_blank=True)

    class Meta:
        model = Ticket
        fields = [
            'id', 'subject', 'description', 'category', 'priority',
            'guest_name', 'guest_company', 'guest_branch', 'guest_phone', 'guest_email',
        ]

    def validate_subject(self, value):
        if not re.search(r'[^\W\d_]', value):
            raise serializers.ValidationError(
                'The subject must contain text, not just numbers or symbols.'
            )
        return value

    def validate_guest_phone(self, value):
        if len(re.sub(r'\D', '', value)) < 6:
            raise serializers.ValidationError('Enter a valid phone number.')
        return value


class GuestCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    # Lets the public tracker tell a support reply apart from the guest's own message.
    is_staff = serializers.SerializerMethodField()
    attachments = AttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Comment
        fields = ['id', 'author_name', 'is_staff', 'body', 'attachments', 'created_at']

    def get_author_name(self, obj):
        if obj.author:
            return obj.author.full_name
        return obj.guest_name or 'Guest'

    def get_is_staff(self, obj):
        return obj.author_id is not None


class GuestTicketPublicSerializer(serializers.ModelSerializer):
    """Safe, public view of a guest ticket returned by the tracking endpoint. Excludes
    internal staff details and the guest's own phone/email."""

    category = serializers.CharField(source='category.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    is_assigned = serializers.SerializerMethodField()
    assigned_agent_name = serializers.SerializerMethodField()
    comments = GuestCommentSerializer(many=True, read_only=True)
    attachments = AttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Ticket
        fields = [
            'id', 'reference', 'subject', 'description', 'status', 'status_display',
            'priority', 'priority_display', 'category', 'guest_name',
            'is_assigned', 'assigned_agent_name', 'rating', 'rating_submitted_at',
            'created_at', 'updated_at', 'comments', 'attachments',
            # Shown on the tracker so a guest can see why their ticket is waiting, the same
            # way a signed-in customer sees it on the ticket page.
            'hold_reason',
            # The far end of "how long has this taken" — without these the tracker can only
            # count up, and a finished ticket would keep ticking forever.
            'resolved_at', 'closed_at',
        ]

    def get_is_assigned(self, obj):
        return obj.assigned_agent_id is not None

    def get_assigned_agent_name(self, obj):
        return obj.assigned_agent.full_name if obj.assigned_agent_id else None
