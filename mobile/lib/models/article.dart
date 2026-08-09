import '../core/config.dart';
import 'ticket.dart';

/// Mirrors ArticleListSerializer / ArticleSerializer. The list form carries an
/// excerpt and no body; the detail form carries the full body.
class Article {
  final int id;
  final String title;
  final String excerpt;
  final String? body;
  final Category? category;
  final bool isPublished;
  final int attachmentCount;
  final String? authorName;
  final DateTime? updatedAt;
  final List<ArticleAttachment> attachments;

  const Article({
    required this.id,
    required this.title,
    this.excerpt = '',
    this.body,
    this.category,
    this.isPublished = true,
    this.attachmentCount = 0,
    this.authorName,
    this.updatedAt,
    this.attachments = const [],
  });

  factory Article.fromJson(Map<String, dynamic> json) => Article(
        id: json['id'] as int,
        title: json['title'] as String? ?? '',
        excerpt: json['excerpt'] as String? ?? '',
        body: json['body'] as String?,
        category: json['category'] is Map
            ? Category.fromJson(json['category'] as Map<String, dynamic>)
            : null,
        isPublished: json['is_published'] as bool? ?? true,
        attachmentCount: json['attachment_count'] as int? ?? 0,
        authorName: json['author_name'] as String?,
        updatedAt: DateTime.tryParse(json['updated_at'] as String? ?? '')?.toLocal(),
        attachments: (json['attachments'] as List? ?? const [])
            .cast<Map<String, dynamic>>()
            .map(ArticleAttachment.fromJson)
            .toList(),
      );
}

class ArticleAttachment {
  final int id;
  final String filename;
  final String? url;
  final int size;

  const ArticleAttachment({
    required this.id,
    required this.filename,
    this.url,
    this.size = 0,
  });

  factory ArticleAttachment.fromJson(Map<String, dynamic> json) =>
      ArticleAttachment(
        id: json['id'] as int,
        filename: json['original_filename'] as String? ?? 'file',
        url: ApiConfig.mediaUrl(json['file'] as String?),
        size: json['size'] as int? ?? 0,
      );

  String get readableSize {
    if (size < 1024) return '$size B';
    if (size < 1024 * 1024) return '${(size / 1024).toStringAsFixed(0)} KB';
    return '${(size / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}
