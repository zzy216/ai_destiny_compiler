import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

void main() {
  runApp(DestinyCompilerApp(api: HttpDestinyApi()));
}

const defaultApiBaseUrl = 'http://127.0.0.1:3000/api';

class DestinyCompilerApp extends StatefulWidget {
  const DestinyCompilerApp({
    super.key,
    required this.api,
    this.sessionStore,
  });

  final DestinyApi api;
  final SessionStore? sessionStore;

  @override
  State<DestinyCompilerApp> createState() => _DestinyCompilerAppState();
}

class _DestinyCompilerAppState extends State<DestinyCompilerApp> {
  late final AppController controller;

  @override
  void initState() {
    super.initState();
    controller = AppController(
      api: widget.api,
      sessionStore: widget.sessionStore ?? InMemorySessionStore(),
    );
    unawaited(controller.restore());
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        return MaterialApp(
          title: '命运编译器',
          debugShowCheckedModeBanner: false,
          theme: ThemeData(
            colorScheme: ColorScheme.fromSeed(
              seedColor: const Color(0xff2f6f5e),
              brightness: Brightness.light,
            ),
            useMaterial3: true,
            inputDecorationTheme: const InputDecorationTheme(
              border: OutlineInputBorder(),
            ),
          ),
          home: controller.session == null
              ? LoginScreen(controller: controller)
              : HomeShell(controller: controller),
        );
      },
    );
  }
}

class ApiException implements Exception {
  ApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class PublicUser {
  const PublicUser({
    required this.id,
    required this.role,
    this.email,
    this.username,
  });

  final String id;
  final String? email;
  final String? username;
  final String role;

  String get displayName => email ?? username ?? id;

  factory PublicUser.fromJson(Map<String, Object?> json) {
    return PublicUser(
      id: json['id'] as String,
      email: json['email'] as String?,
      username: json['username'] as String?,
      role: json['role'] as String,
    );
  }
}

class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresInSeconds,
    required this.user,
  });

  final String accessToken;
  final String refreshToken;
  final int expiresInSeconds;
  final PublicUser user;

  factory AuthSession.fromJson(Map<String, Object?> json) {
    return AuthSession(
      accessToken: json['accessToken'] as String,
      refreshToken: json['refreshToken'] as String,
      expiresInSeconds: json['expiresInSeconds'] as int,
      user: PublicUser.fromJson(json['user'] as Map<String, Object?>),
    );
  }
}

class ModelSummary {
  const ModelSummary({
    required this.id,
    required this.displayName,
    required this.status,
    required this.isDefault,
    required this.isSelectable,
  });

  final String id;
  final String displayName;
  final String status;
  final bool isDefault;
  final bool isSelectable;

  factory ModelSummary.fromJson(Map<String, Object?> json) {
    return ModelSummary(
      id: json['id'] as String,
      displayName: json['displayName'] as String,
      status: json['status'] as String,
      isDefault: json['isDefault'] as bool,
      isSelectable: json['isSelectable'] as bool,
    );
  }
}

class ConversationSummary {
  const ConversationSummary({
    required this.id,
    required this.modelConfigId,
    required this.createdAt,
    this.title,
    this.lastMessageAt,
  });

  final String id;
  final String modelConfigId;
  final String? title;
  final String? lastMessageAt;
  final String createdAt;

  String get displayTitle => title?.isNotEmpty == true ? title! : '未命名咨询';

  factory ConversationSummary.fromJson(Map<String, Object?> json) {
    return ConversationSummary(
      id: json['id'] as String,
      modelConfigId: json['modelConfigId'] as String,
      title: json['title'] as String?,
      lastMessageAt: json['lastMessageAt'] as String?,
      createdAt: json['createdAt'] as String,
    );
  }
}

enum ChatRole { user, assistant, system }

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.role,
    required this.content,
    required this.status,
    required this.createdAt,
  });

  final String id;
  final ChatRole role;
  final String content;
  final String status;
  final String createdAt;

  ChatMessage copyWith({String? content, String? status}) {
    return ChatMessage(
      id: id,
      role: role,
      content: content ?? this.content,
      status: status ?? this.status,
      createdAt: createdAt,
    );
  }

  factory ChatMessage.fromJson(Map<String, Object?> json) {
    return ChatMessage(
      id: json['id'] as String,
      role: switch (json['role']) {
        'assistant' => ChatRole.assistant,
        'system' => ChatRole.system,
        _ => ChatRole.user,
      },
      content: json['content'] as String,
      status: json['status'] as String,
      createdAt: json['createdAt'] as String,
    );
  }
}

class MessageStreamEvent {
  const MessageStreamEvent({required this.event, required this.data});

  final String event;
  final Map<String, Object?> data;
}

abstract class DestinyApi {
  Future<AuthSession> login({
    required String baseUrl,
    required String identifier,
    required String password,
    required String deviceName,
  });

  Future<void> logout({
    required String baseUrl,
    required String refreshToken,
  });

  Future<List<ModelSummary>> listModels({
    required String baseUrl,
    required String accessToken,
  });

  Future<List<ConversationSummary>> listConversations({
    required String baseUrl,
    required String accessToken,
  });

  Future<ConversationSummary> createConversation({
    required String baseUrl,
    required String accessToken,
    required String modelConfigId,
    required String title,
  });

  Future<List<ChatMessage>> listMessages({
    required String baseUrl,
    required String accessToken,
    required String conversationId,
  });

  Stream<MessageStreamEvent> sendMessage({
    required String baseUrl,
    required String accessToken,
    required String conversationId,
    required String content,
    required String idempotencyKey,
  });
}

class HttpDestinyApi implements DestinyApi {
  HttpDestinyApi({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  @override
  Future<AuthSession> login({
    required String baseUrl,
    required String identifier,
    required String password,
    required String deviceName,
  }) async {
    final body = await _postJson(
      baseUrl,
      '/v1/auth/login',
      body: {
        'identifier': identifier,
        'password': password,
        'deviceName': deviceName,
      },
    );
    return AuthSession.fromJson(body['data'] as Map<String, Object?>);
  }

  @override
  Future<void> logout({
    required String baseUrl,
    required String refreshToken,
  }) async {
    await _postJson(
      baseUrl,
      '/v1/auth/logout',
      body: {'refreshToken': refreshToken},
    );
  }

  @override
  Future<List<ModelSummary>> listModels({
    required String baseUrl,
    required String accessToken,
  }) async {
    final body =
        await _getJson(baseUrl, '/v1/models', accessToken: accessToken);
    return _decodeList(body, ModelSummary.fromJson);
  }

  @override
  Future<List<ConversationSummary>> listConversations({
    required String baseUrl,
    required String accessToken,
  }) async {
    final body = await _getJson(
      baseUrl,
      '/v1/conversations',
      accessToken: accessToken,
    );
    return _decodeList(body, ConversationSummary.fromJson);
  }

  @override
  Future<ConversationSummary> createConversation({
    required String baseUrl,
    required String accessToken,
    required String modelConfigId,
    required String title,
  }) async {
    final body = await _postJson(
      baseUrl,
      '/v1/conversations',
      accessToken: accessToken,
      body: {
        'modelConfigId': modelConfigId,
        if (title.trim().isNotEmpty) 'title': title.trim(),
      },
    );
    return ConversationSummary.fromJson(body['data'] as Map<String, Object?>);
  }

  @override
  Future<List<ChatMessage>> listMessages({
    required String baseUrl,
    required String accessToken,
    required String conversationId,
  }) async {
    final body = await _getJson(
      baseUrl,
      '/v1/conversations/$conversationId/messages',
      accessToken: accessToken,
    );
    return _decodeList(body, ChatMessage.fromJson);
  }

  @override
  Stream<MessageStreamEvent> sendMessage({
    required String baseUrl,
    required String accessToken,
    required String conversationId,
    required String content,
    required String idempotencyKey,
  }) async* {
    final request = http.Request(
      'POST',
      _uri(baseUrl, '/v1/conversations/$conversationId/messages'),
    )
      ..headers.addAll(_headers(accessToken))
      ..body = jsonEncode({
        'content': content,
        'idempotencyKey': idempotencyKey,
      });

    final response = await _client.send(request);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final text = await response.stream.bytesToString();
      throw ApiException(_errorMessage(text, response.statusCode));
    }

    final lines =
        response.stream.transform(utf8.decoder).transform(const LineSplitter());
    String? eventName;
    final dataLines = <String>[];

    await for (final line in lines) {
      if (line.startsWith('event:')) {
        eventName = line.substring(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.add(line.substring(5).trim());
      } else if (line.isEmpty && eventName != null) {
        yield MessageStreamEvent(
          event: eventName,
          data: jsonDecode(dataLines.join('\n')) as Map<String, Object?>,
        );
        eventName = null;
        dataLines.clear();
      }
    }
  }

  Future<Map<String, Object?>> _getJson(
    String baseUrl,
    String path, {
    String? accessToken,
  }) async {
    final response = await _client.get(
      _uri(baseUrl, path),
      headers: _headers(accessToken),
    );
    return _decodeResponse(response);
  }

  Future<Map<String, Object?>> _postJson(
    String baseUrl,
    String path, {
    required Map<String, Object?> body,
    String? accessToken,
  }) async {
    final response = await _client.post(
      _uri(baseUrl, path),
      headers: _headers(accessToken),
      body: jsonEncode(body),
    );
    return _decodeResponse(response);
  }

  Map<String, String> _headers(String? accessToken) {
    return {
      'content-type': 'application/json',
      if (accessToken != null) 'authorization': 'Bearer $accessToken',
    };
  }

  Uri _uri(String baseUrl, String path) {
    return Uri.parse('${baseUrl.replaceFirst(RegExp(r'/$'), '')}$path');
  }

  Map<String, Object?> _decodeResponse(http.Response response) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(_errorMessage(response.body, response.statusCode));
    }
    return jsonDecode(response.body) as Map<String, Object?>;
  }

  String _errorMessage(String body, int statusCode) {
    try {
      final json = jsonDecode(body) as Map<String, Object?>;
      final error = json['error'] as Map<String, Object?>?;
      return error?['message'] as String? ?? '请求失败：$statusCode';
    } catch (_) {
      return '请求失败：$statusCode';
    }
  }

  List<T> _decodeList<T>(
    Map<String, Object?> body,
    T Function(Map<String, Object?>) convert,
  ) {
    final data = body['data'] as List<Object?>;
    return data.cast<Map<String, Object?>>().map(convert).toList();
  }
}

class StoredSession {
  const StoredSession({required this.baseUrl, required this.session});

  final String baseUrl;
  final AuthSession session;
}

abstract class SessionStore {
  Future<StoredSession?> load();

  Future<void> save(StoredSession session);

  Future<void> clear();
}

class InMemorySessionStore implements SessionStore {
  StoredSession? _session;

  @override
  Future<StoredSession?> load() async => _session;

  @override
  Future<void> save(StoredSession session) async {
    _session = session;
  }

  @override
  Future<void> clear() async {
    _session = null;
  }
}

class AppController extends ChangeNotifier {
  AppController({
    required DestinyApi api,
    required SessionStore sessionStore,
  })  : _api = api,
        _sessionStore = sessionStore;

  final DestinyApi _api;
  final SessionStore _sessionStore;

  String baseUrl = defaultApiBaseUrl;
  AuthSession? session;
  List<ModelSummary> models = const [];
  List<ConversationSummary> conversations = const [];
  List<ChatMessage> messages = const [];
  String? selectedModelId;
  String? activeConversationId;
  int selectedTab = 0;
  bool busy = false;
  bool sending = false;
  String? error;

  bool get isAuthenticated => session != null;
  bool get hasSelectableModel => selectedModelId != null;

  void selectTab(int index) {
    selectedTab = index;
    notifyListeners();
  }

  void selectModel(String? modelId) {
    selectedModelId = modelId;
    notifyListeners();
  }

  Future<void> restore() async {
    final stored = await _sessionStore.load();
    if (stored == null) return;
    baseUrl = stored.baseUrl;
    session = stored.session;
    notifyListeners();
    await loadWorkspace();
  }

  Future<void> login({
    required String nextBaseUrl,
    required String identifier,
    required String password,
    required String deviceName,
  }) async {
    await _runBusy(() async {
      final nextSession = await _api.login(
        baseUrl: nextBaseUrl,
        identifier: identifier,
        password: password,
        deviceName: deviceName,
      );
      baseUrl = nextBaseUrl;
      session = nextSession;
      await _sessionStore
          .save(StoredSession(baseUrl: baseUrl, session: nextSession));
      await loadWorkspace();
    });
  }

  Future<void> loadWorkspace() async {
    final token = session?.accessToken;
    if (token == null) return;
    models = await _api.listModels(baseUrl: baseUrl, accessToken: token);
    selectedModelId = models
        .where((model) => model.isSelectable)
        .fold<ModelSummary?>(null, (selected, model) {
      if (selected == null || model.isDefault) return model;
      return selected;
    })?.id;
    conversations =
        await _api.listConversations(baseUrl: baseUrl, accessToken: token);
    notifyListeners();
  }

  Future<void> sendQuestion(String content) async {
    final token = session?.accessToken;
    final modelId = selectedModelId;
    if (token == null || modelId == null || content.trim().isEmpty || sending) {
      return;
    }

    sending = true;
    error = null;
    notifyListeners();

    try {
      final conversation = activeConversationId == null
          ? await _api.createConversation(
              baseUrl: baseUrl,
              accessToken: token,
              modelConfigId: modelId,
              title: _titleFrom(content),
            )
          : conversations.firstWhere(
              (item) => item.id == activeConversationId,
              orElse: () => ConversationSummary(
                id: activeConversationId!,
                modelConfigId: modelId,
                createdAt: DateTime.now().toIso8601String(),
              ),
            );

      activeConversationId = conversation.id;
      if (!conversations.any((item) => item.id == conversation.id)) {
        conversations = [conversation, ...conversations];
      }

      final userMessage = ChatMessage(
        id: 'local-user-${DateTime.now().microsecondsSinceEpoch}',
        role: ChatRole.user,
        content: content.trim(),
        status: 'completed',
        createdAt: DateTime.now().toIso8601String(),
      );
      final assistantMessage = ChatMessage(
        id: 'local-assistant-${DateTime.now().microsecondsSinceEpoch}',
        role: ChatRole.assistant,
        content: '',
        status: 'streaming',
        createdAt: DateTime.now().toIso8601String(),
      );
      messages = [...messages, userMessage, assistantMessage];
      notifyListeners();

      await for (final event in _api.sendMessage(
        baseUrl: baseUrl,
        accessToken: token,
        conversationId: conversation.id,
        content: content.trim(),
        idempotencyKey: _uuidV4(),
      )) {
        if (event.event == 'message.delta') {
          final delta = event.data['delta'] as String? ?? '';
          _appendAssistant(delta);
        } else if (event.event == 'message.completed') {
          _completeAssistant(event.data['content'] as String?);
        } else if (event.event == 'run.failed') {
          throw ApiException(
            event.data['errorMessage'] as String? ??
                event.data['message'] as String? ??
                '咨询执行失败',
          );
        }
      }
    } catch (exception) {
      error = exception.toString();
      _completeAssistant(null, status: 'failed');
    } finally {
      sending = false;
      notifyListeners();
    }
  }

  Future<void> openConversation(String conversationId) async {
    final token = session?.accessToken;
    if (token == null) return;
    await _runBusy(() async {
      activeConversationId = conversationId;
      messages = await _api.listMessages(
        baseUrl: baseUrl,
        accessToken: token,
        conversationId: conversationId,
      );
      selectedTab = 0;
    });
  }

  Future<void> logout() async {
    final oldSession = session;
    session = null;
    models = const [];
    conversations = const [];
    messages = const [];
    activeConversationId = null;
    selectedModelId = null;
    selectedTab = 0;
    error = null;
    await _sessionStore.clear();
    notifyListeners();

    if (oldSession != null) {
      try {
        await _api.logout(
            baseUrl: baseUrl, refreshToken: oldSession.refreshToken);
      } catch (_) {
        // Local logout must win even when the server session is already invalid.
      }
    }
  }

  Future<void> _runBusy(Future<void> Function() action) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      await action();
    } catch (exception) {
      error = exception.toString();
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  void _appendAssistant(String delta) {
    final updated = [...messages];
    final index =
        updated.lastIndexWhere((message) => message.role == ChatRole.assistant);
    if (index >= 0) {
      updated[index] = updated[index].copyWith(
        content: '${updated[index].content}$delta',
      );
      messages = updated;
      notifyListeners();
    }
  }

  void _completeAssistant(String? content, {String status = 'completed'}) {
    final updated = [...messages];
    final index =
        updated.lastIndexWhere((message) => message.role == ChatRole.assistant);
    if (index >= 0) {
      updated[index] = updated[index].copyWith(
        content: content ?? updated[index].content,
        status: status,
      );
      messages = updated;
      notifyListeners();
    }
  }

  String _titleFrom(String content) {
    final normalized = content.trim().replaceAll(RegExp(r'\s+'), ' ');
    if (normalized.length <= 24) return normalized;
    return normalized.substring(0, 24);
  }

  String _uuidV4() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex =
        bytes.map((byte) => byte.toRadixString(16).padLeft(2, '0')).join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
  }
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.controller});

  final AppController controller;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  late final TextEditingController baseUrl = TextEditingController(
    text: widget.controller.baseUrl,
  );
  final identifier = TextEditingController();
  final password = TextEditingController();
  final deviceName = TextEditingController(text: 'Flutter Client');

  @override
  void dispose() {
    baseUrl.dispose();
    identifier.dispose();
    password.dispose();
    deviceName.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: ListView(
              padding: const EdgeInsets.all(24),
              shrinkWrap: true,
              children: [
                const Icon(Icons.route, size: 48),
                const SizedBox(height: 16),
                Text(
                  '命运编译器',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 8),
                Text(
                  '不预测命运，只编译下一步。',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 28),
                TextField(
                  key: const Key('baseUrlField'),
                  controller: baseUrl,
                  decoration: const InputDecoration(
                    labelText: 'API 地址',
                    prefixIcon: Icon(Icons.link),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  key: const Key('identifierField'),
                  controller: identifier,
                  decoration: const InputDecoration(
                    labelText: '邮箱或用户名',
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  key: const Key('passwordField'),
                  controller: password,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: '密码',
                    prefixIcon: Icon(Icons.lock_outline),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  key: const Key('deviceNameField'),
                  controller: deviceName,
                  decoration: const InputDecoration(
                    labelText: '设备名',
                    prefixIcon: Icon(Icons.phone_iphone),
                  ),
                ),
                const SizedBox(height: 20),
                FilledButton.icon(
                  key: const Key('loginButton'),
                  onPressed: widget.controller.busy
                      ? null
                      : () => widget.controller.login(
                            nextBaseUrl: baseUrl.text.trim(),
                            identifier: identifier.text.trim(),
                            password: password.text,
                            deviceName: deviceName.text.trim(),
                          ),
                  icon: widget.controller.busy
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.login),
                  label: const Text('登录'),
                ),
                if (widget.controller.error != null) ...[
                  const SizedBox(height: 12),
                  ErrorBanner(message: widget.controller.error!),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class HomeShell extends StatelessWidget {
  const HomeShell({super.key, required this.controller});

  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final pages = [
      ConsultationPage(controller: controller),
      HistoryPage(controller: controller),
      SettingsPage(controller: controller),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('命运编译器'),
        actions: [
          IconButton(
            key: const Key('refreshButton'),
            tooltip: '刷新',
            onPressed: controller.busy ? null : controller.loadWorkspace,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: SafeArea(child: pages[controller.selectedTab]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: controller.selectedTab,
        onDestinationSelected: controller.selectTab,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.auto_fix_high_outlined),
            selectedIcon: Icon(Icons.auto_fix_high),
            label: '咨询',
          ),
          NavigationDestination(
            icon: Icon(Icons.history_outlined),
            selectedIcon: Icon(Icons.history),
            label: '历史',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings),
            label: '设置',
          ),
        ],
      ),
    );
  }
}

class ConsultationPage extends StatefulWidget {
  const ConsultationPage({super.key, required this.controller});

  final AppController controller;

  @override
  State<ConsultationPage> createState() => _ConsultationPageState();
}

class _ConsultationPageState extends State<ConsultationPage> {
  final question = TextEditingController();

  @override
  void dispose() {
    question.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final selectableModels = widget.controller.models
        .where((model) => model.isSelectable)
        .toList(growable: false);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            Expanded(
              child: DropdownButtonFormField<String>(
                key: const Key('modelSelect'),
                value: widget.controller.selectedModelId,
                decoration: const InputDecoration(
                  labelText: '咨询模型',
                  prefixIcon: Icon(Icons.memory),
                ),
                items: [
                  for (final model in selectableModels)
                    DropdownMenuItem(
                      value: model.id,
                      child: Text(model.displayName),
                    ),
                ],
                onChanged: selectableModels.isEmpty
                    ? null
                    : widget.controller.selectModel,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (selectableModels.isEmpty)
          const InfoBanner(message: '暂无可选模型，请先在管理后台发布模型。'),
        if (widget.controller.error != null)
          ErrorBanner(message: widget.controller.error!),
        const SizedBox(height: 8),
        if (widget.controller.messages.isEmpty)
          const EmptyState(
            icon: Icons.edit_note,
            title: '描述一个现实问题',
            subtitle: '法典教练会把它编译成一个可执行、可复盘的下一步。',
          )
        else
          for (final message in widget.controller.messages)
            MessageBubble(message: message),
        const SizedBox(height: 12),
        TextField(
          key: const Key('questionField'),
          controller: question,
          minLines: 3,
          maxLines: 6,
          decoration: const InputDecoration(
            labelText: '当前困境或目标',
            hintText: '例如：我想推进个人项目，但总是在准备阶段卡住。',
            alignLabelWithHint: true,
          ),
        ),
        const SizedBox(height: 12),
        FilledButton.icon(
          key: const Key('sendButton'),
          onPressed:
              widget.controller.hasSelectableModel && !widget.controller.sending
                  ? () async {
                      final content = question.text;
                      question.clear();
                      await widget.controller.sendQuestion(content);
                    }
                  : null,
          icon: widget.controller.sending
              ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.send),
          label: const Text('发送给法典教练'),
        ),
      ],
    );
  }
}

class HistoryPage extends StatelessWidget {
  const HistoryPage({super.key, required this.controller});

  final AppController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.conversations.isEmpty) {
      return const EmptyState(
        icon: Icons.history,
        title: '暂无历史咨询',
        subtitle: '完成一次咨询后，会话会出现在这里。',
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: controller.conversations.length + 1,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (context, index) {
        if (index == 0) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(
              '历史咨询',
              style: Theme.of(context).textTheme.titleLarge,
            ),
          );
        }
        final conversation = controller.conversations[index - 1];
        return ListTile(
          key: Key('conversation-${conversation.id}'),
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.forum_outlined),
          title: Text(conversation.displayTitle),
          subtitle: Text(conversation.lastMessageAt ?? conversation.createdAt),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => controller.openConversation(conversation.id),
        );
      },
    );
  }
}

class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key, required this.controller});

  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final user = controller.session!.user;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        ListTile(
          leading: const Icon(Icons.account_circle_outlined),
          title: Text(user.displayName),
          subtitle: Text('角色：${user.role}'),
        ),
        const Divider(height: 1),
        ListTile(
          leading: const Icon(Icons.link),
          title: const Text('API 地址'),
          subtitle: Text(controller.baseUrl),
        ),
        const SizedBox(height: 20),
        OutlinedButton.icon(
          key: const Key('logoutButton'),
          onPressed: controller.logout,
          icon: const Icon(Icons.logout),
          label: const Text('退出登录'),
        ),
      ],
    );
  }
}

class MessageBubble extends StatelessWidget {
  const MessageBubble({super.key, required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final isUser = message.role == ChatRole.user;
    final colors = Theme.of(context).colorScheme;
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 620),
        margin: const EdgeInsets.symmetric(vertical: 6),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color:
              isUser ? colors.primaryContainer : colors.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              isUser ? '我' : '法典教练',
              style: Theme.of(context).textTheme.labelMedium,
            ),
            const SizedBox(height: 6),
            Text(message.content.isEmpty ? '生成中...' : message.content),
          ],
        ),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 36),
      child: Column(
        children: [
          Icon(icon, size: 42),
          const SizedBox(height: 12),
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 6),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ],
      ),
    );
  }
}

class ErrorBanner extends StatelessWidget {
  const ErrorBanner({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Theme.of(context).colorScheme.errorContainer,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            const Icon(Icons.error_outline),
            const SizedBox(width: 8),
            Expanded(child: Text(message)),
          ],
        ),
      ),
    );
  }
}

class InfoBanner extends StatelessWidget {
  const InfoBanner({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Theme.of(context).colorScheme.secondaryContainer,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            const Icon(Icons.info_outline),
            const SizedBox(width: 8),
            Expanded(child: Text(message)),
          ],
        ),
      ),
    );
  }
}
