import anyTest, { TestInterface } from 'ava';
import * as td from 'testdouble';
import { Context, addFake } from './fake_lycan';
import { success } from 'specshell';
import { createApp } from './utils';
import { UnauthorizedError, NotFoundError } from '@binaris/spice-koa-server/interfaces';

const test = anyTest as TestInterface<Context>;

addFake(test);

const app = createApp({ locked: true, lockReason: 'template application' });

const anything = td.matchers.anything();

test.beforeEach(async (t) => {
  t.assert(success(await t.context.shell.run(`cd ${t.context.projectDir}`)));
  t.log(t.context.projectDir);
});

test('unlockApp unlocks a locked application by given app name', async (t) => {
  td.when(t.context.lycanFake.getAppByName(anything, app.name)).thenResolve(app);
  const result = await t.context.shell.run(`${t.context.run} unlock ${app.name} `, 'utf-8');
  t.snapshot(result);
  td.verify(t.context.lycanFake.unlockApp(anything, app.id));
});

test('unlockApp locks a locked application by current directory', async (t) => {
  const projectApp = createApp({ id: 'fluffy-samaritan' });
  td.when(t.context.lycanFake.getApp(anything, projectApp.id)).thenResolve(projectApp);
  const result = await t.context.shell.run(`${t.context.run} unlock`, 'utf-8');
  t.snapshot(result);
  td.verify(t.context.lycanFake.unlockApp(anything, projectApp.id));
});

test('unlock command fails when not given an app name in local project dir', async (t) => {
  const result = await t.context.shell.run(`cd .. && ${t.context.run} unlock`, 'utf-8');
  // This snapshot will always break on another machine beacuse every machine has it's own path
  // The first value in result.err contains the global error message (splited by :)
  const relevantError = result.err.split(':').slice(0, 2).join(':');
  t.snapshot({ ...result, err: relevantError });
});

test('unlock command throws NotFoundError when given app name not found', async (t) => {
  td.when(t.context.lycanFake.getAppByName(anything, 'fluffy-test')).thenReject(new NotFoundError('not found'));
  const result = await t.context.shell.run(`cd .. && ${t.context.run} unlock fluffy-test`, 'utf-8');
  t.snapshot(result);
});

test('unlock command throws UnauthorizedError if no permission', async (t) => {
  td.when(t.context.lycanFake.unlockApp(anything, 'fluffy-samaritan')).thenReject(new UnauthorizedError('no auth'));
  const result = await t.context.shell.run(`${t.context.run} unlock`, 'utf-8');
  t.snapshot(result);
});

test('unlock command fails when too many args specified', async (t) => {
  const result = await t.context.shell.run(`${t.context.run} unlock arg extra-arg`, 'utf-8');
  t.snapshot(result);
});
