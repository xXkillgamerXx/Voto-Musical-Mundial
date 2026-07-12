import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }

    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      case TargetPlatform.macOS:
        return macos;
      default:
        throw UnsupportedError(
          'Firebase no está configurado para ${defaultTargetPlatform.name}.',
        );
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyBSyjidw1cmZRaQQCp07WaY63Pjaetdtno',
    appId: '1:927668152816:android:80b38e4c249a2737acd535',
    messagingSenderId: '927668152816',
    projectId: 'votos-3420a',
    storageBucket: 'votos-3420a.firebasestorage.app',
    databaseURL: 'https://votos-3420a-default-rtdb.firebaseio.com',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyBSyjidw1cmZRaQQCp07WaY63Pjaetdtno',
    appId: '1:927668152816:ios:b0edf446a080ae98acd535',
    messagingSenderId: '927668152816',
    projectId: 'votos-3420a',
    storageBucket: 'votos-3420a.firebasestorage.app',
    databaseURL: 'https://votos-3420a-default-rtdb.firebaseio.com',
    iosBundleId: 'com.votomusicamundial.app',
  );

  static const FirebaseOptions macos = FirebaseOptions(
    apiKey: 'AIzaSyBSyjidw1cmZRaQQCp07WaY63Pjaetdtno',
    appId: '1:927668152816:ios:b0edf446a080ae98acd535',
    messagingSenderId: '927668152816',
    projectId: 'votos-3420a',
    storageBucket: 'votos-3420a.firebasestorage.app',
    databaseURL: 'https://votos-3420a-default-rtdb.firebaseio.com',
    iosBundleId: 'com.votomusicamundial.app',
  );

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyDkPn1mXsJ0h32uwdImbv5gR9XpD9sgQWE',
    appId: '1:927668152816:web:73205cba757f9553acd535',
    messagingSenderId: '927668152816',
    projectId: 'votos-3420a',
    authDomain: 'votos-3420a.firebaseapp.com',
    storageBucket: 'votos-3420a.firebasestorage.app',
    databaseURL: 'https://votos-3420a-default-rtdb.firebaseio.com',
    measurementId: 'G-TPJGWP4Q2X',
  );
}
