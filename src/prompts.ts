import { note } from '@clack/prompts';
import { OpenAI } from 'openai';
import { getConfig } from './commands/config';
import { i18n, I18nLocals } from './i18n';
import { configureCommitlintIntegration } from './modules/commitlint/config';
import { commitlintPrompts } from './modules/commitlint/prompts';
import { ConsistencyPrompt } from './modules/commitlint/types';
import * as utils from './modules/commitlint/utils';
import { removeConventionalCommitWord } from './utils/removeConventionalCommitWord';
import { getJiraTicketFromBranch } from './utils/git';

const config = getConfig();
const translation = i18n[(config.OCO_LANGUAGE as I18nLocals) || 'en'];

export const IDENTITY =
  'You are to act as an author of a commit message in git.';

const GITMOJI_HELP = `Use GitMoji convention to preface the conventional commit keywords. The expected output format is: \`<emoji><keyword>(<scope>):<commit message>\`. Here are some help to choose the right emoji (emoji, description): 
🐛, Fix a bug; 
✨, Introduce new features; 
📝, Add or update documentation; 
🚀, Deploy stuff; 
✅, Add, update, or pass tests; 
♻️, Refactor code; 
⬆️, Upgrade dependencies; 
🔧, Add or update configuration files; 
🌐, Internationalization and localization; 
💡, Add or update comments in source code;\n`;

const FULL_GITMOJI_SPEC = `${GITMOJI_HELP}
🎨, Improve structure / format of the code; 
⚡️, Improve performance; 
🔥, Remove code or files; 
🚑️, Critical hotfix; 
💄, Add or update the UI and style files; 
🎉, Begin a project; 
🔒️, Fix security issues; 
🔐, Add or update secrets; 
🔖, Release / Version tags; 
🚨, Fix compiler / linter warnings; 
🚧, Work in progress; 
💚, Fix CI Build; 
⬇️, Downgrade dependencies; 
📌, Pin dependencies to specific versions; 
👷, Add or update CI build system; 
📈, Add or update analytics or track code; 
➕, Add a dependency; 
➖, Remove a dependency; 
🔨, Add or update development scripts; 
✏️, Fix typos; 
💩, Write bad code that needs to be improved; 
⏪️, Revert changes; 
🔀, Merge branches; 
📦️, Add or update compiled files or packages; 
👽️, Update code due to external API changes; 
🚚, Move or rename resources (e.g.: files, paths, routes); 
📄, Add or update license; 
💥, Introduce breaking changes; 
🍱, Add or update assets; 
♿️, Improve accessibility; 
🍻, Write code drunkenly; 
💬, Add or update text and literals; 
🗃️, Perform database related changes; 
🔊, Add or update logs; 
🔇, Remove logs; 
👥, Add or update contributor(s); 
🚸, Improve user experience / usability; 
🏗️, Make architectural changes; 
📱, Work on responsive design; 
🤡, Mock things; 
🥚, Add or update an easter egg; 
🙈, Add or update a .gitignore file; 
📸, Add or update snapshots; 
⚗️, Perform experiments; 
🔍️, Improve SEO; 
🏷️, Add or update types; 
🌱, Add or update seed files; 
🚩, Add, update, or remove feature flags; 
🥅, Catch errors; 
💫, Add or update animations and transitions; 
🗑️, Deprecate code that needs to be cleaned up; 
🛂, Work on code related to authorization, roles and permissions; 
🩹, Simple fix for a non-critical issue; 
🧐, Data exploration/inspection; 
⚰️, Remove dead code; 
🧪, Add a failing test; 
👔, Add or update business logic; 
🩺, Add or update healthcheck; 
🧱, Infrastructure related changes; 
🧑‍💻, Improve developer experience; 
💸, Add sponsorships or money related infrastructure; 
🧵, Add or update code related to multithreading or concurrency; 
🦺, Add or update code related to validation.`;

// TODO allow a list of keywords
const CONVENTIONAL_COMMIT_KEYWORDS =
  'Preface the commit with the conventional commit keywords: fix, feat, build, chore, ci, docs, style, refactor, perf, test, eval.';

const getCommitConvention = (fullGitMojiSpec: boolean) => {
  let result = '';
  // Always include both guidelines
  result += `${CONVENTIONAL_COMMIT_KEYWORDS}\n`;
  if (config.OCO_EMOJI) {
    result += '\n' + (fullGitMojiSpec ? FULL_GITMOJI_SPEC : GITMOJI_HELP);
  }
  return result.trim();
};

const getDescriptionInstruction = () =>
  config.OCO_DESCRIPTION
    ? 'Add a short description of WHY the changes are done after the commit message. Don\'t start it with "This commit", just describe the changes.'
    : "Don't add any descriptions to the commit, only commit message.";

const getScopeInstruction = (jiraTicket?: string) => {
  if (config.OCO_JIRA_TICKET_SCOPE) {
    return `Use "${jiraTicket}" as the scope of the commit message. The expected output format is: \`<emoji><keyword>(${jiraTicket}):<commit message>\``;
  } else {
    return `Use the common denominator of all changes as the scope of the commit message. The expected output format is: \`<emoji><keyword>(common denominator):<commit message>\``;
  }
};

/**
 * Get the context of the user input
 * @param extraArgs - The arguments passed to the command line
 * @example
 *  $ oco -- This is a context used to generate the commit message
 * @returns - The context of the user input
 */
const userInputCodeContext = (context: string) => {
  if (context !== '' && context !== ' ') {
    return `Additional context provided by the user: <context>${context}</context>\nConsider this context when generating the commit message, incorporating relevant information when appropriate.`;
  }
  return '';
};

const INIT_MAIN_PROMPT = (
  language: string,
  fullGitMojiSpec: boolean,
  context: string,
  jiraTicket?: string
): OpenAI.Chat.Completions.ChatCompletionMessageParam => ({
  role: 'system',
  content: (() => {
    const commitConvention = fullGitMojiSpec
      ? 'GitMoji specification'
      : 'Conventional Commit Convention';
    const missionStatement = `${IDENTITY} Your mission is to create a clean and comprehensive commit message as per the ${commitConvention} and explain WHAT changes were made and WHY they were made.`;
    const diffInstruction =
      "I'll send you an output of 'git diff --staged' command, and you are to convert it into a commit message.";
    const conventionGuidelines = getCommitConvention(fullGitMojiSpec);
    const descriptionGuideline = getDescriptionInstruction();
    const scopeInstruction = getScopeInstruction(jiraTicket);
    const generalGuidelines = `Craft a concise, single sentence, commit message that encapsulates all changes made, with an emphasis on the primary updates. The goal is to provide a clear and unified overview of the changes in one single message. Use the present tense. Lines must not be longer than 74 characters. Use ${language} for the commit message.`;
    const userInputContext = userInputCodeContext(context);

    const promptContent = `
  # Your Mission
  ${missionStatement}
  ## Task
  ${diffInstruction}
  ## Commit Guidelines
  * ${conventionGuidelines}
  * ${scopeInstruction}
  ## General Guidelines
  * ${generalGuidelines}
  * ${descriptionGuideline}
  * ${userInputContext}
  `.trim();
    return promptContent;
  })()
});

export const INIT_DIFF_PROMPT: OpenAI.Chat.Completions.ChatCompletionMessageParam =
  {
    role: 'user',
    content: `diff --git a/src/server.ts b/src/server.ts
    index ad4db42..f3b18a9 100644
    --- a/src/server.ts
    +++ b/src/server.ts
    @@ -10,7 +10,7 @@
    import {
        initWinstonLogger();
        
        const app = express();
        -const port = 7799;
        +const PORT = 7799;
        
        app.use(express.json());
        
        @@ -34,6 +34,6 @@
        app.use((_, res, next) => {
            // ROUTES
            app.use(PROTECTED_ROUTER_URL, protectedRouter);
            
            -app.listen(port, () => {
                -  console.log(\`Server listening on port \${port}\`);
                +app.listen(process.env.PORT || PORT, () => {
                    +  console.log(\`Server listening on port \${PORT}\`);
                });`
  };

const COMMIT_TYPES = {
  fix: '🐛',
  feat: '✨'
} as const;

const generateCommitString = (
  type: keyof typeof COMMIT_TYPES,
  message: string
): string => {
  const cleanMessage = removeConventionalCommitWord(message);
  return config.OCO_EMOJI ? `${COMMIT_TYPES[type]} ${cleanMessage}` : message;
};

const getConsistencyContent = (translation: ConsistencyPrompt) => {
  const fixMessage = translation.commitFix;
  const featMessage = translation.commitFeat;

  const fix = generateCommitString('fix', fixMessage);
  const feat = generateCommitString('feat', featMessage);

  const description = config.OCO_DESCRIPTION
    ? translation.commitDescription
    : '';

  return [fix, feat, description].filter(Boolean).join('\n');
};

const INIT_CONSISTENCY_PROMPT = (
  translation: ConsistencyPrompt
): OpenAI.Chat.Completions.ChatCompletionMessageParam => ({
  role: 'assistant',
  content: getConsistencyContent(translation)
});

export const getMainCommitPrompt = async (
  fullGitMojiSpec: boolean,
  context: string,
  jiraTicket?: Promise<string>
): Promise<Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>> => {
  const resolvedJiraTicket = await getJiraTicketFromBranch();
  switch (config.OCO_PROMPT_MODULE) {
    case '@commitlint':
      if (!(await utils.commitlintLLMConfigExists())) {
        note(
          `OCO_PROMPT_MODULE is @commitlint but you haven't generated consistency for this project yet.`
        );
        await configureCommitlintIntegration();
      }

      // Replace example prompt with a prompt that's generated by OpenAI for the commitlint config.
      const commitLintConfig = await utils.getCommitlintLLMConfig();

      return [
        commitlintPrompts.INIT_MAIN_PROMPT(
          translation.localLanguage,
          commitLintConfig.prompts
        ),
        INIT_DIFF_PROMPT,
        INIT_CONSISTENCY_PROMPT(
          commitLintConfig.consistency[
            translation.localLanguage
          ] as ConsistencyPrompt
        )
      ];

    default:
      return [
        INIT_MAIN_PROMPT(translation.localLanguage, fullGitMojiSpec, context, resolvedJiraTicket),
        INIT_DIFF_PROMPT,
        INIT_CONSISTENCY_PROMPT(translation)
      ];
  }
};
