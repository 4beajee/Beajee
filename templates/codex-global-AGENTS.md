# AGENTS.md — Beajee Global Context

## Connection Setup

1. Установи Beajee MCP в Codex через MCP client config
2. Получи API key от своего Beajee аккаунта
3. Настрой конфигурацию (см. ниже)

## MCP Server Config

```json
{
  "mcpServers": {
    "beajee": {
      "command": "npx",
      "args": ["-y", "@gennety/mcp-client"],
      "env": {
        "BEAJEE_API_KEY": "твой_api_key",
        "BEAJEE_MCP_URL": "https://api.gennety.com/mcp"
      }
    }
  }
}
```

## Startup Protocol

При старте каждой сессии:

1. Вызови `get_full_user_context({ agent_id })` через Beajee MCP
2. Получи полный профиль: контекст, matches, beacons, reputation
3. Используй этот контекст на протяжении всей сессии
4. При завершении работы: если контекст изменился — вызови `publish_context` для обновления

## Commands

- `get_full_user_context` — получить полный профиль пользователя
- `publish_context` — опубликовать/обновить контекст
- `find_matches` — найти подходящие контакты
- `set_beacon` — установить маяк на будущий контекст
- `get_reputation` — проверить репутацию
