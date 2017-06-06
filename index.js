#!/usr/bin/env node

'use strict';
const readline = require('readline');
const validateProjectName = require('validate-npm-package-name');
const chalk = require('chalk');
const commander = require('commander');
const fs = require('fs-extra');
const path = require('path');
const execSync = require('child_process').execSync;
const spawn = require('cross-spawn');
const Promise = require('bluebird');

const packageJson = require('./package.json');

let projectName;

commander
    .version(packageJson.version)
    .arguments('<project-directory>')
    .usage(`${chalk.green('<project-directory>')}`)
    .action(name => {
        projectName = name;
    })
    .parse(process.argv);

if (typeof projectName === 'undefined') {
    console.error('Please specify the project directory:');
    console.log(
        `  ${chalk.cyan(commander.name())} ${chalk.green('<project-directory>')}`
    );
    console.log();
    console.log('For example:');
    console.log(`  ${chalk.cyan(commander.name())} ${chalk.green('my-react-app')}`);
    console.log();
    process.exit(1);
}

createApp(projectName);

function createApp(name) {
    const root = path.resolve(name);
    const appName = path.basename(root);
    const useYarn = shouldUseYarn();

    checkAppName(appName);
    validateDir(root, appName)
        .then(function () {
            process.chdir(root);
            initGit();
            console.log(chalk.cyan('git 已成功初始化'));
        })
        .then(function () {
            return fs.copy(path.resolve(__dirname, 'template'), root)
                .then(function () {
                    fs.renameSync(path.join(root, '.npmignore'), path.join(root, '.gitignore'));
                });
        })
        .then(function () {
            return saveProjectName(root, appName);
        })
        .then(function () {
            console.log(chalk.cyan(`${appName} 项目目录已经成功创建`));
            console.log(chalk.cyan('开始安装依赖包，可能需要几分钟……'));
            return installDependencies(useYarn);
        })
        .then(function () {
            showSuccessMessage(root, appName, useYarn);
        })
        .catch(function (err) {
            console.log(chalk.red('出错啦'));
            console.error(err);
        })
}

function checkAppName(appName) {
    const validationResult = validateProjectName(appName);
    if (!validationResult.validForNewPackages) {
        console.error(
            `Could not create a project called ${chalk.red(`"${appName}"`)} because of npm naming restrictions:`
        );
        printValidationResults(validationResult.errors);
        printValidationResults(validationResult.warnings);
        process.exit(1);
    }
}

function printValidationResults(results) {
    if (typeof results !== 'undefined') {
        results.forEach(error => {
            console.error(chalk.red(`  *  ${error}`));
        });
    }
}

function shouldUseYarn() {
    try {
        execSync('yarnpkg --version', { stdio: 'ignore' });
        return true;
    } catch (e) {
        return false;
    }
}

function initGit() {
    execSync('git init');
}

function validateDir(dir, appName) {
    const isExist = fs.existsSync(dir);

    if (!isExist) {
        return fs.ensureDir(dir);
    }

    const stat = fs.statSync(dir);
    if (stat.isDirectory()) {
        return new Promise( (resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            rl.question(`文件夹 ${appName} 已经存在，继续操作可能会导致对现有文件的覆盖，是否要继续 y/n ?`, (answer) => {
                rl.close();
                if (!answer || answer !== 'y') {
                    process.exit(1);
                } else {
                    return resolve();
                }
            });
        });
    } else {
        console.error(
            `${chalk.red(`"${appName}"`)} 已经存在，请重新指定项目名称`
        );
        process.exit(1);
    }
}

function installDependencies(useYarn) {
    let command;
    let args;

    if (useYarn) {
        command = 'yarn';
    } else {
        command = 'npm';
        args = ['install'];
    }

    return new Promise(function (resolve, reject) {
        const child = spawn(command, args, { stdio: 'inherit' });
        child.on('close', code => {
            if (code !== 0) {
                reject({
                    command: `${command} ${args.join(' ')}`,
                });
                return;
            }
            resolve();
        });
    });
}

function saveProjectName(root, name) {
    const filePath = path.join(root, 'package.json');
    const packageJson = require(filePath);
    packageJson.name = name;

    return fs.writeJson(filePath,packageJson, {spaces: 4});
}

function showSuccessMessage(root, appName, useYarn) {
    const displayedCommand = useYarn ? 'yarn' : 'npm';

    console.log();
    console.log(`Success! Created ${appName} at ${root}`);
    console.log('Inside that directory, you can run several commands:');
    console.log();
    console.log(chalk.cyan(`  ${displayedCommand} start`));
    console.log('    Starts the development server.');
    console.log();
    console.log(
        chalk.cyan(`  ${displayedCommand} ${useYarn ? '' : 'run '}build`)
    );
    console.log('    Bundles the app into static files for production.');

    console.log('Happy hacking!');
}