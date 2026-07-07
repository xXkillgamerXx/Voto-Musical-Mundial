import 'package:flutter/foundation.dart';

import 'auth_models.dart';
import 'auth_storage.dart';

class AuthSession extends ChangeNotifier {
  ApiAuth? _auth;
  bool _isReady = false;

  ApiAuth? get auth => _auth;
  ApiUser? get user => _auth?.user;
  bool get isReady => _isReady;
  bool get isSignedIn => _auth != null;

  Future<void> load() async {
    _auth = await AuthStorage.read();
    _isReady = true;
    notifyListeners();
  }

  Future<void> setAuth(ApiAuth? auth) async {
    _auth = auth;
    await AuthStorage.write(auth);
    notifyListeners();
  }

  Future<void> updateUser(ApiUser user) async {
    if (_auth == null) return;
    _auth = _auth!.copyWith(user: user);
    await AuthStorage.write(_auth);
    notifyListeners();
  }

  Future<void> signOut() => setAuth(null);
}
