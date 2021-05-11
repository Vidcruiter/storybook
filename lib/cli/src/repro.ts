import prompts from 'prompts';
import path from 'path';
import chalk from 'chalk';
import { createAndInit, Parameters, exec } from './repro-generators/scripts';
import * as configs from './repro-generators/configs';
import { SupportedFrameworks } from './project_types';

const logger = console;

interface ReproOptions {
  outputDirectory: string;
  framework?: SupportedFrameworks;
  list?: boolean;
  template?: string;
  e2e?: boolean;
  generator?: string;
  pnp?: boolean;
}

const TEMPLATES = configs as Record<string, Parameters>;

const FRAMEWORKS = Object.values(configs).reduce<Record<SupportedFrameworks, Parameters[]>>(
  (acc, cur) => {
    acc[cur.framework] = [...(acc[cur.framework] || []), cur];
    return acc;
  },
  {} as Record<SupportedFrameworks, Parameters[]>
);

export const repro = async ({
  outputDirectory,
  list,
  template,
  framework,
  generator,
  e2e,
  pnp,
}: ReproOptions) => {
  if (list) {
    logger.info('🌈 Available templates');
    Object.entries(FRAMEWORKS).forEach(([fmwrk, templates]) => {
      logger.info(fmwrk);
      templates.forEach((t) => logger.info(`- ${t.name}`));
      if (fmwrk === 'other') {
        logger.info('- blank');
      }
    });
    return;
  }

  let selectedTemplate = template;
  let selectedFramework = framework;
  if (!selectedTemplate && !generator) {
    if (!selectedFramework) {
      const { framework: frameworkOpt } = await prompts({
        type: 'select',
        message: '🌈 Select the repro framework',
        name: 'framework',
        choices: Object.keys(FRAMEWORKS).map((f) => ({ title: f, value: f })),
      });
      selectedFramework = frameworkOpt;
    }
    selectedTemplate = (
      await prompts({
        type: 'select',
        message: '📝 Select the repro base template',
        name: 'template',
        choices: FRAMEWORKS[selectedFramework as SupportedFrameworks].map((f) => ({
          title: f.name,
          value: f.name,
        })),
      })
    ).template;
  }

  const selectedConfig = !generator
    ? TEMPLATES[selectedTemplate]
    : {
        name: 'custom',
        version: 'custom',
        generator,
      };

  if (!selectedConfig) {
    throw new Error('🚨 Repro: please specify a valid template type');
  }

  let selectedDirectory = outputDirectory;
  if (!selectedDirectory) {
    const { directory } = await prompts({
      type: 'text',
      message: 'Enter the output directory',
      name: 'directory',
    });
    selectedDirectory = directory;
    // if (fs.existsSync(selectedDirectory)) {
    //   throw new Error(`Repro: ${selectedDirectory} already exists`);
    // }
  }

  try {
    const cwd = path.isAbsolute(selectedDirectory)
      ? selectedDirectory
      : path.join(process.cwd(), selectedDirectory);

    logger.info(`🏃 Running ${selectedTemplate} into ${cwd}`);

    await createAndInit(cwd, selectedConfig, {
      e2e: !!e2e,
      pnp: !!pnp,
    });

    if (!e2e) {
      await initGitRepo(cwd);
    }

    logger.info('');
    logger.info('🎉 Your Storybook reproduction project is ready to use! Now:');
    logger.info('');
    logger.info(chalk.yellow(`cd ${selectedDirectory}`));
    logger.info(chalk.yellow(`yarn storybook`));
    logger.info('');
    logger.info("Once you've recreated the problem you're experiencing,");
    logger.info('publish to github and  paste the repo link in your issue.');
    logger.info('Having a clean repro helps us solve your issue faster! 🙏');
    logger.info('');
  } catch (error) {
    logger.error('🚨 Failed to create repro');
  }
};

const initGitRepo = async (cwd: string) => {
  await exec('git init', { cwd });
  await exec('echo "node_modules" >> .gitignore', { cwd });
  await exec('git add --all', { cwd });
  await exec('git commit -am "added storybook"', { cwd });
  await exec('git tag repro-base', { cwd });
};
