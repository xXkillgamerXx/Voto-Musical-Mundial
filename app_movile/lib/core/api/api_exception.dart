class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode, this.payload});

  final String message;
  final int? statusCode;
  final dynamic payload;

  @override
  String toString() => message;
}
