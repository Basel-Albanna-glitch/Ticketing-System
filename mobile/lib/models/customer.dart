import '../core/config.dart';

/// Mirrors accounts.serializers.CustomerSerializer.
class Customer {
  final int id;
  final String username;
  final String fullName;
  final String email;
  final String phone;
  final String address;
  final String taxNumber;
  final bool isActive;
  final int ticketCount;
  final int openCount;
  final String? avatarUrl;

  /// Free text holding a [SoftwareType]'s *name*, not its id — `software_type`
  /// is a plain CharField on the user model, and the picker only exists to keep
  /// the spelling consistent. Empty means none.
  final String softwareType;

  final List<CustomerBranch> branches;
  final List<CustomerLicense> licenses;

  const Customer({
    required this.id,
    required this.username,
    required this.fullName,
    this.email = '',
    this.phone = '',
    this.address = '',
    this.taxNumber = '',
    this.isActive = true,
    this.ticketCount = 0,
    this.openCount = 0,
    this.avatarUrl,
    this.softwareType = '',
    this.branches = const [],
    this.licenses = const [],
  });

  String get initials {
    final parts =
        fullName.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
    if (parts.isEmpty) return username.isEmpty ? '?' : username[0].toUpperCase();
    return parts.take(2).map((p) => p[0].toUpperCase()).join();
  }

  factory Customer.fromJson(Map<String, dynamic> json) => Customer(
        id: json['id'] as int,
        username: json['username'] as String? ?? '',
        fullName: json['full_name'] as String? ?? '',
        email: json['email'] as String? ?? '',
        phone: json['phone'] as String? ?? '',
        address: json['address'] as String? ?? '',
        taxNumber: json['tax_number'] as String? ?? '',
        isActive: json['is_active'] as bool? ?? true,
        ticketCount: json['ticket_count'] as int? ?? 0,
        openCount: json['open_count'] as int? ?? 0,
        avatarUrl: ApiConfig.mediaUrl(json['avatar'] as String?),
        softwareType: json['software_type'] as String? ?? '',
        branches: (json['branches'] as List? ?? const [])
            .cast<Map<String, dynamic>>()
            .map(CustomerBranch.fromJson)
            .toList(),
        licenses: (json['licenses'] as List? ?? const [])
            .cast<Map<String, dynamic>>()
            .map(CustomerLicense.fromJson)
            .toList(),
      );
}

/// Mirrors accounts.serializers.SoftwareTypeSerializer.
class SoftwareType {
  final int id;
  final String name;

  const SoftwareType({required this.id, required this.name});

  factory SoftwareType.fromJson(Map<String, dynamic> json) => SoftwareType(
        id: json['id'] as int,
        name: json['name'] as String? ?? '',
      );
}

class CustomerBranch {
  final int id;
  final String name;
  final String address;
  final int ticketCount;

  const CustomerBranch({
    required this.id,
    required this.name,
    this.address = '',
    this.ticketCount = 0,
  });

  factory CustomerBranch.fromJson(Map<String, dynamic> json) => CustomerBranch(
        id: json['id'] as int,
        name: json['name'] as String? ?? '',
        address: json['address'] as String? ?? '',
        ticketCount: json['ticket_count'] as int? ?? 0,
      );
}

class CustomerLicense {
  final int id;
  final String name;
  final DateTime? startDate;
  final DateTime? endDate;

  const CustomerLicense({
    required this.id,
    required this.name,
    this.startDate,
    this.endDate,
  });

  /// Drives the expiry pill on the profile — the web app highlights lapsed
  /// licences the same way.
  bool get isExpired =>
      endDate != null && endDate!.isBefore(DateTime.now());

  factory CustomerLicense.fromJson(Map<String, dynamic> json) => CustomerLicense(
        id: json['id'] as int,
        name: json['name'] as String? ?? '',
        startDate: DateTime.tryParse(json['start_date'] as String? ?? ''),
        endDate: DateTime.tryParse(json['end_date'] as String? ?? ''),
      );
}
