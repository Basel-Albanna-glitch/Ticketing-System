import '../core/config.dart';

/// Mirrors accounts.serializers.UserSerializer.
class AppUser {
  final int id;
  final String username;
  final String fullName;
  final String email;
  final String role; // 'admin' | 'agent' | 'customer'
  final bool isAvailable;
  final String? avatarUrl;

  const AppUser({
    required this.id,
    required this.username,
    required this.fullName,
    required this.email,
    required this.role,
    required this.isAvailable,
    this.avatarUrl,
  });

  /// Admins see the agent-side UI: every staff-only endpoint the app uses is
  /// permitted for both roles (IsAdminOrAgent in tickets/views.py).
  bool get isStaff => role == 'admin' || role == 'agent';
  bool get isAdmin => role == 'admin';
  bool get isCustomer => role == 'customer';

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: json['id'] as int,
        username: json['username'] as String? ?? '',
        fullName: json['full_name'] as String? ?? '',
        email: json['email'] as String? ?? '',
        role: json['role'] as String? ?? 'customer',
        isAvailable: json['is_available'] as bool? ?? false,
        avatarUrl: ApiConfig.mediaUrl(json['avatar'] as String?),
      );

  String get initials {
    final parts = fullName.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
    if (parts.isEmpty) return username.isEmpty ? '?' : username[0].toUpperCase();
    return parts.take(2).map((p) => p[0].toUpperCase()).join();
  }
}
