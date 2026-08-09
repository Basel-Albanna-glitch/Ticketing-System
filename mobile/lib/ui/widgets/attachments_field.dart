import 'dart:io';

import 'package:flutter/material.dart';

import '../../core/attachment_picker.dart';
import '../../i18n/i18n.dart';
import '../theme.dart';

/// Add/remove list of files staged for upload, shared by every form that can
/// attach something.
class AttachmentsField extends StatelessWidget {
  final List<PickedAttachment> attachments;
  final ValueChanged<List<PickedAttachment>> onChanged;
  /// Overrides the default "Attachments" heading. Null uses the
  /// translated default, which cannot be a parameter default because it
  /// needs a BuildContext.
  final String? title;

  const AttachmentsField({
    super.key,
    required this.attachments,
    required this.onChanged,
    this.title,
  });

  Future<void> _add(BuildContext context) async {
    final source = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.description_outlined),
              title: Text(context.t('attachments.chooseFiles')),
              subtitle: Text(context.t('attachments.chooseFilesHint')),
              onTap: () => Navigator.pop(context, 'documents'),
            ),
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: Text(context.t('attachments.takePhoto')),
              onTap: () => Navigator.pop(context, 'camera'),
            ),
          ],
        ),
      ),
    );
    if (source == null) return;

    if (source == 'camera') {
      final shot = await AttachmentPicker.takePhoto();
      if (shot != null) onChanged([...attachments, shot]);
      return;
    }

    final picked = await AttachmentPicker.pickDocuments();
    if (picked.isNotEmpty) onChanged([...attachments, ...picked]);
  }

  IconData _iconFor(PickedAttachment a) {
    final ext = a.name.toLowerCase();
    if (a.isImage) return Icons.image_outlined;
    if (ext.endsWith('.pdf')) return Icons.picture_as_pdf_outlined;
    if (ext.endsWith('.doc') || ext.endsWith('.docx')) {
      return Icons.article_outlined;
    }
    if (ext.endsWith('.xls') || ext.endsWith('.xlsx') || ext.endsWith('.csv')) {
      return Icons.table_chart_outlined;
    }
    if (ext.endsWith('.zip') || ext.endsWith('.rar')) {
      return Icons.folder_zip_outlined;
    }
    return Icons.insert_drive_file_outlined;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final heading = title ?? context.t('attachments.title');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                attachments.isEmpty
                    ? heading
                    : '$heading (${attachments.length})',
                style: theme.textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
            ),
            TextButton.icon(
              onPressed: () => _add(context),
              icon: const Icon(Icons.attach_file, size: 18),
              label: Text(context.t('common.add')),
            ),
          ],
        ),
        for (var i = 0; i < attachments.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: AppCard(
              child: ListTile(
                dense: true,
                leading: attachments[i].isImage
                    ? ClipRRect(
                        borderRadius: BorderRadius.circular(6),
                        child: Image.file(
                          File(attachments[i].path),
                          width: 40,
                          height: 40,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) =>
                              Icon(_iconFor(attachments[i])),
                        ),
                      )
                    : Icon(_iconFor(attachments[i]),
                        color: theme.colorScheme.primary),
                title: Text(attachments[i].name,
                    maxLines: 1, overflow: TextOverflow.ellipsis),
                subtitle: Text(attachments[i].readableSize),
                trailing: IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => onChanged(
                    [...attachments]..removeAt(i),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
