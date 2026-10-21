module.exports=async(page)=>{
  await page.waitForFunction(()=>document.querySelector('#mel-info')&&document.querySelector('#mel-info').textContent.includes('notes'),{timeout:15000});
  const info1=await page.$eval('#mel-info',e=>e.textContent);
  // regenerate with a different seed
  await page.evaluate(()=>{document.getElementById('seed').value='777'});
  await page.click('#generate');
  await new Promise(r=>setTimeout(r,500));
  const info2=await page.$eval('#mel-info',e=>e.textContent);
  if(info1===info2)throw new Error('seed change did not change melody');
  // canvas has notes painted
  const painted=await page.evaluate(()=>{const c=document.getElementById('roll');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4){if(d[i]>0)n++}return n});
  if(painted<500)throw new Error('piano roll looks empty: '+painted);
  // save + reload flow
  await page.evaluate(()=>{document.getElementById('save-name').value='Test Tune'});
  await page.click('#save-btn');
  await page.waitForFunction(()=>document.querySelectorAll('.save-row').length>=1,{timeout:10000});
  const saved=await page.$eval('.save-row',e=>e.textContent);
  if(!/Test Tune/.test(saved))throw new Error('save failed');
  return `2 melodies generated (${info1.split('·')[0].trim()} / ${info2.split('·')[0].trim()}), roll painted (${painted} px), save ok`;
};
