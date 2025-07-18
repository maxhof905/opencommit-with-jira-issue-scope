# OpenCommit-With-Jira-Issue-Scope

![commit preview](docs/commit_preview.png)

Fork from [OpenCommit](https://github.com/di-sukharev/opencommit) with added JIRA ticket integration

## ✨ What's New

This fork adds **automatic JIRA ticket integration** to OpenCommit, allowing you to automatically include JIRA ticket numbers in your commit message scopes based on your current Git branch name.

### 🎯 Key Features

- **Automatic JIRA Ticket Detection**: Extracts JIRA tickets (e.g., `GA-1234`, `PROJ-5678`) from branch names
- **Smart Scope Integration**: Uses the JIRA ticket as the commit message scope when `OCO_JIRA_TICKET_SCOPE` is enabled. Else, it uses the common denominator of changes as the scope.

Example commit message with JIRA ticket:
```
✨ feat(GA-1234): implement user authentication system
```


## 🚀 Quick Start

### Use this fork
see docs/howto.md for how to work on improving this fork locally

Clone the repo of this fork inside the repo folder do
```bash
npm install
npm run build
npm link
```

Navigate to the folder you want to use this package in and do
```bash
npm link opencommit-with-jira-issue-scope
oco # this should reflect the changes made in this fork, assuming the right .env variables are set, see below
```

### Configuration

#### Enable JIRA Integration (Default: enabled)
```bash
oco config set OCO_JIRA_TICKET_SCOPE=true
```

#### Disable JIRA Integration
```bash
oco config set OCO_JIRA_TICKET_SCOPE=false
```

When disabled, OpenCommit will use the common denominator of changes as the scope instead.

***AKA the settings currently needed to make this work***
### Essential Settings
Set them as env variables or set them as global defaults:

```bash
# set local default
oco config set <CONFIG_PARAM>

# set global default
open ~/.opencommit
```
#### Use with OpenAI Settings
OCO_AI_PROVIDER=openai
OCO_API_KEY=...
OCO_MODEL=gpt-4o-mini

#### Use with Ollama settings
OCO_API_URL=http://localhost:11434/api/chat
OCO_AI_PROVIDER=ollama
OCO_MODEL=llama3:8b

***NOTE deprecated OCO_OMIT_SCOPE and OCO_ONE_LINE_COMMIT for the purpose of this fork***
#### all other settings
OCO_API_CUSTOM_HEADERS=undefined
OCO_TOKENS_MAX_INPUT=4096
OCO_TOKENS_MAX_OUTPUT=70
OCO_DESCRIPTION=false
OCO_EMOJI=true
OCO_LANGUAGE=en
OCO_MESSAGE_TEMPLATE_PLACEHOLDER=$msg
OCO_PROMPT_MODULE=conventional-commit
OCO_TEST_MOCK_TYPE=commit-message
OCO_JIRA_TICKET_SCOPE=true
OCO_GITPUSH=true
OCO_WHY=false


## 📄 License

MIT License - same as the original OpenCommit project.

## 🙏 Acknowledgments

- Original [OpenCommit](https://github.com/di-sukharev/opencommit) by [@di-sukharev](https://github.com/di-sukharev)
