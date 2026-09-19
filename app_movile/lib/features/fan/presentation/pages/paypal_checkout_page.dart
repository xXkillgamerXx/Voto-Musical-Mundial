import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../../../core/i18n/tr.dart';

class PaypalCheckoutPage extends StatefulWidget {
  const PaypalCheckoutPage({
    required this.approveUrl,
    super.key,
  });

  final String approveUrl;

  static Future<bool> open(BuildContext context, {required String approveUrl}) async {
    final result = await Navigator.of(context, rootNavigator: true).push<bool>(
      MaterialPageRoute(
        builder: (_) => PaypalCheckoutPage(approveUrl: approveUrl),
      ),
    );
    return result == true;
  }

  @override
  State<PaypalCheckoutPage> createState() => _PaypalCheckoutPageState();
}

class _PaypalCheckoutPageState extends State<PaypalCheckoutPage> {
  late final WebViewController _controller;
  var _loading = true;

  bool _isReturn(Uri uri) {
    final path = uri.path.toLowerCase();
    return path.contains('/paypal/return');
  }

  bool _isCancel(Uri uri) {
    final path = uri.path.toLowerCase();
    return path.contains('/paypal/cancel');
  }

  void _finish(bool success) {
    if (!mounted) return;
    Navigator.of(context).pop(success);
  }

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF050213))
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) {
            if (mounted) setState(() => _loading = true);
          },
          onPageFinished: (_) {
            if (mounted) setState(() => _loading = false);
          },
          onNavigationRequest: (request) {
            final uri = Uri.tryParse(request.url);
            if (uri == null) return NavigationDecision.navigate;
            if (_isReturn(uri)) {
              _finish(true);
              return NavigationDecision.prevent;
            }
            if (_isCancel(uri)) {
              _finish(false);
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadRequest(Uri.parse(widget.approveUrl));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF050213),
      appBar: AppBar(
        backgroundColor: const Color(0xFF09061B),
        foregroundColor: Colors.white,
        title: Text(tr('fan.paypalTitle')),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => _finish(false),
        ),
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_loading)
            const LinearProgressIndicator(
              color: Color(0xFFFBBF24),
              backgroundColor: Color(0xFF1E1438),
              minHeight: 3,
            ),
        ],
      ),
    );
  }
}
