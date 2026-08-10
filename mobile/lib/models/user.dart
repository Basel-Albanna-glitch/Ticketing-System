import '../core/config.dart';

/// Mirrors accounts.serializers.MeSerializer.
class AppUser {
  final int id;
  final String username;
  final String fullName;
  final String email;
  final String role; // 'admin' | 'agent' | 'customer'
  final bool isAvailable;
  final String? avatarUrl;

  /// What this user may actually do, already resolved by the server from their
  /// staff role, or the site-wide defaults when they hold none.
  ///
  /// Ask this rather than re-deriving `isAdmin || settings[flag]`: a role can
  /// narrow an admin, and it can grant an agent something the site-wide switch
  /// leaves off. Deriving it here is how the app and the API end up disagreeing
  /// about who may do what.
  final Map<String, bool> permissions;

  /// An admin holding no role — the only kind nothing is withheld from, and the
  /// only kind allowed to manage roles.
  final bool isFullAdmin;

  /// Name of the assigned staff role, or null. Display only.
  final String? staffRoleName;

  const AppUser({
    required this.id,
    required this.username,
    required this.fullName,
    required this.email,
    required this.role,
    required this.isAvailable,
    this.avatarUrl,
    this.permissions = const {},
    this.isFullAdmin = false,
    this.staffRoleName,
  });

  bool get isStaff => role == 'admin' || role == 'agent';
  bool get isAdmin => role == 'admin';
  bool get isCustomer => role == 'customer';

  /// Whether a named permission is held. Unknown names read as false, so a flag
  /// added on the server before the app knows about it fails closed.
  bool can(String flag) => permissions[flag] ?? false;

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: json['id'] as int,
        username: json['username'] as String? ?? '',
        fullName: json['full_name'] as String? ?? '',
        email: json['email'] as String? ?? '',
        role: json['role'] as String? ?? 'customer',
        isAvailable: json['is_available'] as bool? ?? false,
        avatarUrl: ApiConfig.mediaUrl(json['avatar'] as String?),
        // Absent on an older server, which simply leaves every flag false.
        permissions: {
          for (final entry in (json['permissions'] as Map<String, dynamic>? ?? {}).entries)
            entry.key: entry.value == true,
        },
        isFullAdmin: json['is_full_admin'] as bool? ?? false,
        staffRoleName: json['staff_role_name'] as String?,
      );

  String get initials {
    final parts = fullName.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
    if (parts.isEmpty) return username.isEmpty ? '?' : username[0].toUpperCase();
    return parts.take(2).map((p) => p[0].toUpperCase()).join();
  }
}
