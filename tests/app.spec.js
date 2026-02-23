import { test, expect } from '@playwright/test';

test('login page loads with auth form', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#authContainer')).toBeVisible();
  await expect(page.locator('#loginBtn')).toBeVisible();
});

test('ETA date input is visible in the input section', async ({ page }) => {
  await page.goto('/');
  const etaInput = page.locator('#etaInput');
  await expect(etaInput).toBeAttached();
  await expect(etaInput).toHaveAttribute('type', 'date');
});

test('page title is MeBoard', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('MeBoard');
});

test('new user signup auto-signs in without email verification prompt', async ({ page }) => {
  let signupPayload = null;
  let signinPayload = null;
  await page.route('**/auth/v1/signup', async (route) => {
    signupPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: '11111111-1111-1111-1111-111111111111', email: 'new-user@example.com' },
        session: null,
      }),
    });
  });
  await page.route('**/auth/v1/token**', async (route) => {
    signinPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'fake-access-token',
        refresh_token: 'fake-refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        user: { id: '11111111-1111-1111-1111-111111111111', email: 'new-user@example.com' },
      }),
    });
  });

  await page.goto('/');
  await page.locator('#registerLink').click();
  await page.locator('#regEmailInput').fill('new-user@example.com');
  await page.locator('#regPasswordInput').fill('abc12345');
  await page.locator('#regConfirmPasswordInput').fill('abc12345');
  await page.locator('#registerBtn').click();

  await expect(page.locator('#authMessage')).toContainText('注册成功');
  expect(signupPayload).toMatchObject({
    email: 'new-user@example.com',
    password: 'abc12345',
  });
  expect(signinPayload).toMatchObject({
    email: 'new-user@example.com',
    password: 'abc12345',
  });
});

test('todo text edit controls are rendered and toggle on edit click', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const { setTodos, renderTodos } = await import('/js/todos.js');
    document.getElementById('appContainer').style.display = 'block';
    setTodos([{
      id: 'todo-edit-1',
      text: 'Editable item',
      status: '未开始',
      priority: 'P2',
      eta: null,
      category: 'Others',
      created_at: '2024-01-01T00:00:00.000Z',
      image_url: null,
    }]);
    renderTodos();
  });

  const item = page.locator('.todo-item[data-id="todo-edit-1"]');
  await expect(item.locator('.edit-text-btn')).toBeVisible();
  await item.locator('.edit-text-btn').click();
  await expect(item.locator('.todo-text-save-btn')).toBeVisible();
  await expect(item.locator('.todo-text-cancel-btn')).toBeVisible();
});

test('todo image management controls are visible for item with image', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const { setTodos, renderTodos } = await import('/js/todos.js');
    document.getElementById('appContainer').style.display = 'block';
    setTodos([{
      id: 'todo-image-1',
      text: 'Image item',
      status: '未开始',
      priority: 'P2',
      eta: null,
      category: 'Others',
      created_at: '2024-01-01T00:00:00.000Z',
      image_url: 'https://example.com/img.png',
    }]);
    renderTodos();
  });

  const item = page.locator('.todo-item[data-id="todo-image-1"]');
  await expect(item.locator('.todo-image-add-btn')).toBeVisible();
  await expect(item.locator('.todo-image-replace-btn')).toBeVisible();
  await expect(item.locator('.todo-image-delete-btn')).toBeVisible();
  await expect(item.locator('.todo-image-count-hint')).toHaveText('1/10');
});
