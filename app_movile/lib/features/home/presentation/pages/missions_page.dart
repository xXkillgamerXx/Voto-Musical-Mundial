import 'package:flutter/material.dart';

import '../../../../core/widgets/skeleton_box.dart';
import '../../../auth/data/auth_service.dart';
import '../../data/mission.dart';
import '../../data/missions_api.dart';
import '../widgets/missions_section.dart';

class MissionsPage extends StatefulWidget {
  const MissionsPage({required this.authService, super.key});

  final AuthService authService;

  @override
  State<MissionsPage> createState() => _MissionsPageState();
}

class _MissionsPageState extends State<MissionsPage> {
  late final MissionsApi _missionsApi;
  late Future<List<Mission>> _missionsFuture;

  @override
  void initState() {
    super.initState();
    _missionsApi = MissionsApi(widget.authService.client);
    _missionsFuture = _missionsApi.getMissions();
  }

  Future<void> _reload({bool forceRefresh = true}) async {
    final future = _missionsApi.getMissions(forceRefresh: forceRefresh);
    setState(() => _missionsFuture = future);
    await future;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Mission>>(
      future: _missionsFuture,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.error_outline_rounded,
                    color: Color(0xFFF0ABFC),
                    size: 42,
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'No se pudieron cargar las misiones.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: () => _reload(),
                    child: const Text('Reintentar'),
                  ),
                ],
              ),
            ),
          );
        }

        if (!snapshot.hasData) {
          return const Padding(
            padding: EdgeInsets.fromLTRB(16, 24, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: SkeletonBox(height: 12, width: 140),
                ),
                SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerLeft,
                  child: SkeletonBox(height: 28, width: 180),
                ),
                SizedBox(height: 18),
                SkeletonBox(height: 320),
              ],
            ),
          );
        }

        return RefreshIndicator(
          color: const Color(0xFFF0ABFC),
          backgroundColor: const Color(0xFF120A2B),
          onRefresh: () => _reload(),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.only(bottom: 120),
            children: [
              MissionsSection(
                authService: widget.authService,
                missions: snapshot.data!,
                onMissionsChanged: () => _reload(),
              ),
            ],
          ),
        );
      },
    );
  }
}
