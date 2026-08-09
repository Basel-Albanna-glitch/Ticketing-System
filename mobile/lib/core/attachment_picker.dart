import 'dart:io';

import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;

/// A file staged for upload.
class PickedAttachment {
  final String path;
  final String name;
  final int size;
  final String mimeType;

  const PickedAttachment({
    required this.path,
    required this.name,
    this.size = 0,
    this.mimeType = '',
  });

  bool get isImage => mimeType.startsWith('image/') ||
      const ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic']
          .contains(p.extension(name).toLowerCase());

  String get readableSize {
    if (size < 1024) return '$size B';
    if (size < 1024 * 1024) return '${(size / 1024).toStringAsFixed(0)} KB';
    return '${(size / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  static PickedAttachment fromMap(Map<Object?, Object?> map) {
    final path = map['path'] as String;
    return PickedAttachment(
      path: path,
      name: map['name'] as String? ?? p.basename(path),
      size: (map['size'] as num?)?.toInt() ?? 0,
      mimeType: map['mimeType'] as String? ?? '',
    );
  }

  static PickedAttachment fromXFile(XFile file) {
    var length = 0;
    try {
      length = File(file.path).lengthSync();
    } on FileSystemException {
      // A picker can return a path that is not readable as a plain file;
      // reporting 0 B beats discarding the selection.
    }
    return PickedAttachment(
      path: file.path,
      name: p.basename(file.name),
      size: length,
      mimeType: file.mimeType ?? '',
    );
  }
}

/// Picks files to attach.
///
/// Documents go through a method channel into the app's own Kotlin
/// (MainActivity), which calls Android's ACTION_OPEN_DOCUMENT. The file_picker
/// plugin would be the usual choice but is incompatible with Flutter 3.44's
/// built-in Kotlin. Camera capture still uses image_picker, which handles the
/// permission and capture flow properly.
class AttachmentPicker {
  static const _channel = MethodChannel('hermes/documents');

  /// Any file type — documents, PDFs, images already on the device.
  static Future<List<PickedAttachment>> pickDocuments({
    bool allowMultiple = true,
  }) async {
    try {
      final result = await _channel.invokeMethod<List<Object?>>('pick', {
        'allowMultiple': allowMultiple,
      });
      if (result == null) return const [];
      return result
          .cast<Map<Object?, Object?>>()
          .map(PickedAttachment.fromMap)
          .toList();
    } on PlatformException {
      return const [];
    } on MissingPluginException {
      // Only happens on a platform where the channel is not registered.
      return const [];
    }
  }

  /// Take a photo with the camera.
  static Future<PickedAttachment?> takePhoto() async {
    final shot = await ImagePicker().pickImage(source: ImageSource.camera);
    return shot == null ? null : PickedAttachment.fromXFile(shot);
  }
}
