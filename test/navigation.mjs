// Exercise the same floating navigation on desktop and mobile.
export async function navigateUI(page,destination){
 if(destination==='account'){await page.locator('.topbar [data-page=account]').click();return;}
 const primary=page.locator(`.app-dock [data-page=${destination}]`);
 if(await primary.count())await primary.click();
 else{await page.locator('[data-mobile-more]').click();await page.locator(`#mobile-menu [data-page=${destination}]`).click();}
}

// Fresh logins enter the app directly; also handle a setup page explicitly opened by a suite.
export async function skipFirstUse(page){
 await page.waitForSelector('body:not(.signed-out)');
 if(await page.locator('#onboarding-form').count()){
  await page.locator('[data-skip-onboarding]').click();
  await page.waitForFunction(()=>location.hash!=='#welcome');
 }
}

export async function logoutUI(page){
 await navigateUI(page,'account');
 await page.locator('#profile-logout').click();
}
