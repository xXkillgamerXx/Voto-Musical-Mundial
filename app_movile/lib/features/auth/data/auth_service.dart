import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

class AuthService {
  AuthService._();

  static final auth = FirebaseAuth.instance;
  static final db = FirebaseFirestore.instance;
  static bool _isGoogleInitialized = false;

  static String friendlyError(Object error) {
    if (error is FirebaseAuthException) {
      return switch (error.code) {
        'invalid-email' => 'Escribe un correo válido.',
        'invalid-credential' => 'Correo o contraseña incorrectos.',
        'user-not-found' => 'No existe una cuenta con ese correo.',
        'wrong-password' => 'Contraseña incorrecta.',
        'too-many-requests' => 'Demasiados intentos. Intenta más tarde.',
        'email-already-in-use' => 'Ese correo ya está registrado.',
        'weak-password' => 'La contraseña debe tener al menos 6 caracteres.',
        'network-request-failed' => 'Revisa tu conexión a internet.',
        'operation-not-allowed' => 'Este método de acceso no está habilitado.',
        _ => 'No se pudo completar la acción. Intenta otra vez.',
      };
    }

    return 'No se pudo completar la acción. Intenta otra vez.';
  }

  static Future<UserCredential> signInWithGoogle() async {
    final googleSignIn = GoogleSignIn.instance;

    if (!_isGoogleInitialized) {
      await googleSignIn.initialize();
      _isGoogleInitialized = true;
    }

    final googleUser = await googleSignIn.authenticate();
    final googleAuth = googleUser.authentication;
    final credential = GoogleAuthProvider.credential(
      idToken: googleAuth.idToken,
    );

    final userCredential = await auth.signInWithCredential(credential);
    final user = userCredential.user;

    if (user != null) {
      await _ensureGoogleUserDocument(user);
    }

    return userCredential;
  }

  static Future<void> _ensureGoogleUserDocument(User user) async {
    final userRef = db.collection('users').doc(user.uid);
    final userSnap = await userRef.get();
    final displayName = user.displayName?.trim() ?? '';
    final firstName = displayName.isEmpty
        ? ''
        : displayName.split(RegExp(r'\s+')).first;

    if (userSnap.exists) {
      return;
    }

    await userRef.set({
      'firstName': firstName,
      'lastName': '',
      'name': displayName,
      'username': '',
      'country': '',
      'countryCode': '',
      'phoneCountry': '',
      'phoneCountryCode': '',
      'phoneDialCode': '',
      'phone': '',
      'phoneInternational': '',
      'email': user.email ?? '',
      'points': 25,
      'spentPoints': 0,
      'createdAt': FieldValue.serverTimestamp(),
    });
  }
}
