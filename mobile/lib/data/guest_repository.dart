import 'package:dio/dio.dart';
import 'package:path/path.dart' as p;

import '../core/api_client.dart';
import '../models/guest_ticket.dart';
import '../models/ticket.dart';

/// The public, unauthenticated endpoints.
///
/// Every call sets `skipAuth`, which matters for two reasons: a signed-out user
/// has no token to send, and a 401 from these routes must never trigger the
/// refresh-and-retry interceptor.
class GuestRepository {
  final ApiClient api;

  GuestRepository(this.api);

  static Options get _public => Options(extra: {'skipAuth': true});

  /// Categories offered on the public form. Separate from /categories/, which
  /// requires authentication.
  Future<List<Category>> categories() async {
    final res = await api.dio.get('/public/categories/', options: _public);
    final data = res.data;
    final rows = data is List ? data : (data['results'] as List? ?? const []);
    return rows.cast<Map<String, dynamic>>().map(Category.fromJson).toList();
  }

  /// Submit a ticket without an account. Returns the created ticket so the
  /// reference number can be shown — it is what the guest needs to track it.
  Future<Ticket> submit({
    required String name,
    required String phone,
    required String subject,
    required String description,
    required int categoryId,
    String company = '',
    String branch = '',
    String email = '',
    String priority = TicketPriority.medium,
    List<String> attachmentPaths = const [],
  }) async {
    final fields = <String, dynamic>{
      'guest_name': name,
      'guest_phone': phone,
      'guest_company': company,
      'guest_branch': branch,
      'guest_email': email,
      'subject': subject,
      'description': description,
      'category': categoryId,
      'priority': priority,
    };

    final Object payload;
    if (attachmentPaths.isEmpty) {
      payload = fields;
    } else {
      final form = FormData.fromMap(fields);
      for (final path in attachmentPaths) {
        form.files.add(MapEntry(
          'attachments',
          await MultipartFile.fromFile(path, filename: p.basename(path)),
        ));
      }
      payload = form;
    }

    final res = await api.dio.post(
      '/tickets/guest/',
      data: payload,
      options: _public,
    );
    return Ticket.fromJson(res.data as Map<String, dynamic>);
  }

  /// Look up a ticket by reference + phone. Both are required — the pair is
  /// what stops guest tickets being enumerable.
  Future<GuestTicket> track({
    required String reference,
    required String phone,
  }) async {
    final res = await api.dio.post(
      '/tickets/guest/track/',
      data: {'reference': reference, 'phone': phone},
      options: _public,
    );
    return GuestTicket.fromJson(res.data as Map<String, dynamic>);
  }

  Future<void> reply({
    required String reference,
    required String phone,
    required String body,
  }) {
    return api.dio.post(
      '/tickets/guest/reply/',
      data: {'reference': reference, 'phone': phone, 'body': body},
      options: _public,
    );
  }

  Future<void> rate({
    required String reference,
    required String phone,
    required int score,
    String comment = '',
  }) {
    return api.dio.post(
      '/tickets/guest/rate/',
      data: {
        'reference': reference,
        'phone': phone,
        'score': score,
        'comment': comment,
      },
      options: _public,
    );
  }
}
