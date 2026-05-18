const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let changed = false;
  let imgIndex = 0;
  
  // First, strip all existing loading="lazy" just in case there are remnants
  content = content.replace(/ loading="lazy"/g, '');
  
  // Now add loading="lazy" selectively
  content = content.replace(/<img\s([^>]+)>/g, (match, attrs) => {
      imgIndex++;
      // Skip the first 4 images (logo, loader logo, and main hero images)
      if (imgIndex <= 4) return match;
      if (attrs.includes('loading=')) return match;
      changed = true;
      return `<img loading="lazy" ${attrs}>`;
  });
  
  if (changed) {
      fs.writeFileSync(f, content);
      console.log('Optimized ' + f);
  }
});
