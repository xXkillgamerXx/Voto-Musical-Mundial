import 'package:flutter/material.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/i18n/tr.dart';
import '../../auth/data/auth_service.dart';
import '../data/reports_api.dart';

Future<void> showReportSheet(
  BuildContext hostContext, {
  required AuthService authService,
  required String targetType,
  required String targetId,
  String? reportedUserId,
  String? pollId,
}) async {
  final me = authService.session.user;
  if (me != null &&
      ((reportedUserId != null && reportedUserId == me.id) ||
          targetId == me.id)) {
    ScaffoldMessenger.of(hostContext).showSnackBar(
      SnackBar(content: Text(tr('report.own'))),
    );
    return;
  }

  final reasons = ['spam', 'offensive', 'sexual', 'harassment', 'other'];
  var selected = reasons.first;
  final details = TextEditingController();
  var sending = false;

  await showModalBottomSheet<void>(
    context: hostContext,
    isScrollControlled: true,
    backgroundColor: const Color(0xFF120A2B),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (sheetContext) {
      return Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          16,
          20,
          20 + MediaQuery.viewInsetsOf(sheetContext).bottom,
        ),
        child: StatefulBuilder(
          builder: (context, setModalState) {
            return Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 42,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  targetType == 'comment'
                      ? tr('report.comment')
                      : tr('report.profile'),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  tr('report.reason'),
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.6),
                    fontWeight: FontWeight.w800,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final reason in reasons)
                      ChoiceChip(
                        label: Text(tr('report.$reason')),
                        selected: selected == reason,
                        onSelected: sending
                            ? null
                            : (_) => setModalState(() => selected = reason),
                        selectedColor: const Color(0xFFD946EF),
                        backgroundColor: Colors.white.withValues(alpha: 0.06),
                        labelStyle: TextStyle(
                          color: selected == reason
                              ? Colors.white
                              : Colors.white.withValues(alpha: 0.8),
                          fontWeight: FontWeight.w800,
                        ),
                        side: BorderSide(
                          color: selected == reason
                              ? const Color(0xFFD946EF)
                              : Colors.white.withValues(alpha: 0.12),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: details,
                  enabled: !sending,
                  maxLength: 500,
                  maxLines: 3,
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(
                    hintText: tr('report.details'),
                    hintStyle: TextStyle(
                      color: Colors.white.withValues(alpha: 0.35),
                    ),
                    filled: true,
                    fillColor: Colors.white.withValues(alpha: 0.05),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: BorderSide(
                        color: Colors.white.withValues(alpha: 0.1),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                FilledButton(
                  onPressed: sending
                      ? null
                      : () async {
                          setModalState(() => sending = true);
                          try {
                            final message = await ReportsApi(
                              authService.client,
                            ).create(
                              targetType: targetType,
                              targetId: targetId,
                              reason: selected,
                              details: details.text,
                              reportedUserId: reportedUserId,
                              pollId: pollId,
                            );
                            if (!sheetContext.mounted) return;
                            Navigator.of(sheetContext).pop();
                            final text = message.isNotEmpty
                                ? message
                                : tr('report.thanks');
                            if (hostContext.mounted) {
                              ScaffoldMessenger.of(hostContext).showSnackBar(
                                SnackBar(content: Text(text)),
                              );
                            }
                          } catch (error) {
                            setModalState(() => sending = false);
                            if (!sheetContext.mounted) return;
                            final text = error is ApiException
                                ? error.message
                                : tr('common.error');
                            ScaffoldMessenger.of(sheetContext).showSnackBar(
                              SnackBar(content: Text(text)),
                            );
                          }
                        },
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFD946EF),
                    foregroundColor: Colors.white,
                    minimumSize: const Size.fromHeight(48),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: sending
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(tr('report.send')),
                ),
              ],
            );
          },
        ),
      );
    },
  );
  details.dispose();
}
