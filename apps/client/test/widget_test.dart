import 'package:destiny_compiler_client/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('shows login first and loads consultation workspace after login',
      (tester) async {
    final api = FakeDestinyApi();

    await tester.pumpWidget(DestinyCompilerApp(api: api));

    expect(find.text('命运编译器'), findsOneWidget);
    expect(find.byKey(const Key('identifierField')), findsOneWidget);

    await tester.enterText(
        find.byKey(const Key('identifierField')), 'destiny_test');
    await tester.enterText(
        find.byKey(const Key('passwordField')), 'very-secure-pass');
    await tester.tap(find.byKey(const Key('loginButton')));
    await tester.pumpAndSettle();

    expect(find.text('描述一个现实问题'), findsOneWidget);
    expect(find.text('Ollama 本地模型'), findsOneWidget);
    expect(api.loginCalls, 1);
    expect(api.listModelsCalls, 1);
  });

  testWidgets('creates a conversation and appends streamed assistant reply',
      (tester) async {
    final api = FakeDestinyApi();
    await tester.pumpWidget(DestinyCompilerApp(api: api));
    await _login(tester);

    await tester.enterText(
        find.byKey(const Key('questionField')), '我总是在准备阶段卡住');
    await tester.tap(find.byKey(const Key('sendButton')));
    await tester.pumpAndSettle();

    expect(find.text('我总是在准备阶段卡住'), findsOneWidget);
    expect(find.text('先交付一个30分钟内可完成的版本。'), findsOneWidget);
    expect(api.createdConversationTitle, '我总是在准备阶段卡住');
    expect(api.sentMessages, ['我总是在准备阶段卡住']);
  });

  testWidgets('opens conversation history and loads messages', (tester) async {
    final api = FakeDestinyApi();
    await tester.pumpWidget(DestinyCompilerApp(api: api));
    await _login(tester);

    await tester.tap(find.text('历史'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('既有咨询'));
    await tester.pumpAndSettle();

    expect(find.text('历史问题'), findsOneWidget);
    expect(find.text('历史回答'), findsOneWidget);
    expect(api.loadedConversationId, 'conversation-existing');
  });

  testWidgets('clears local session on logout', (tester) async {
    final api = FakeDestinyApi();
    await tester.pumpWidget(DestinyCompilerApp(api: api));
    await _login(tester);

    await tester.tap(find.text('设置'));
    await tester.pumpAndSettle();
    expect(find.text('destiny-test@destiny.local'), findsOneWidget);

    await tester.tap(find.byKey(const Key('logoutButton')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('identifierField')), findsOneWidget);
    expect(api.logoutCalls, 1);
  });
}

Future<void> _login(WidgetTester tester) async {
  await tester.enterText(
      find.byKey(const Key('identifierField')), 'destiny_test');
  await tester.enterText(
      find.byKey(const Key('passwordField')), 'very-secure-pass');
  await tester.tap(find.byKey(const Key('loginButton')));
  await tester.pumpAndSettle();
}

class FakeDestinyApi implements DestinyApi {
  int loginCalls = 0;
  int listModelsCalls = 0;
  int logoutCalls = 0;
  String? createdConversationTitle;
  String? loadedConversationId;
  final sentMessages = <String>[];

  @override
  Future<AuthSession> login({
    required String baseUrl,
    required String identifier,
    required String password,
    required String deviceName,
  }) async {
    loginCalls += 1;
    return const AuthSession(
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresInSeconds: 900,
      user: PublicUser(
        id: 'user-1',
        email: 'destiny-test@destiny.local',
        username: 'destiny_test',
        role: 'user',
      ),
    );
  }

  @override
  Future<void> logout({
    required String baseUrl,
    required String refreshToken,
  }) async {
    logoutCalls += 1;
  }

  @override
  Future<List<ModelSummary>> listModels({
    required String baseUrl,
    required String accessToken,
  }) async {
    listModelsCalls += 1;
    return const [
      ModelSummary(
        id: 'model-1',
        displayName: 'Ollama 本地模型',
        status: 'published',
        isDefault: true,
        isSelectable: true,
      ),
    ];
  }

  @override
  Future<List<ConversationSummary>> listConversations({
    required String baseUrl,
    required String accessToken,
  }) async {
    return const [
      ConversationSummary(
        id: 'conversation-existing',
        modelConfigId: 'model-1',
        title: '既有咨询',
        lastMessageAt: '2026-07-18T12:00:00.000Z',
        createdAt: '2026-07-18T12:00:00.000Z',
      ),
    ];
  }

  @override
  Future<ConversationSummary> createConversation({
    required String baseUrl,
    required String accessToken,
    required String modelConfigId,
    required String title,
  }) async {
    createdConversationTitle = title;
    return const ConversationSummary(
      id: 'conversation-new',
      modelConfigId: 'model-1',
      title: '我总是在准备阶段卡住',
      createdAt: '2026-07-18T12:30:00.000Z',
    );
  }

  @override
  Future<List<ChatMessage>> listMessages({
    required String baseUrl,
    required String accessToken,
    required String conversationId,
  }) async {
    loadedConversationId = conversationId;
    return const [
      ChatMessage(
        id: 'message-1',
        role: ChatRole.user,
        content: '历史问题',
        status: 'completed',
        createdAt: '2026-07-18T12:00:00.000Z',
      ),
      ChatMessage(
        id: 'message-2',
        role: ChatRole.assistant,
        content: '历史回答',
        status: 'completed',
        createdAt: '2026-07-18T12:00:01.000Z',
      ),
    ];
  }

  @override
  Stream<MessageStreamEvent> sendMessage({
    required String baseUrl,
    required String accessToken,
    required String conversationId,
    required String content,
    required String idempotencyKey,
  }) async* {
    sentMessages.add(content);
    yield const MessageStreamEvent(
      event: 'message.delta',
      data: {'delta': '先交付一个'},
    );
    yield const MessageStreamEvent(
      event: 'message.delta',
      data: {'delta': '30分钟内可完成的版本。'},
    );
    yield const MessageStreamEvent(
      event: 'message.completed',
      data: {'content': '先交付一个30分钟内可完成的版本。'},
    );
  }
}
