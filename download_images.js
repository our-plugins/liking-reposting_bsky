const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const imageUrls = [
  'https://uprecipes.blog/wp-content/uploads/2025/04/nana-dots-irish-soda-bread-a-1.jpg',
  'https://uprecipes.blog/wp-content/uploads/2025/04/grandma-minnies-old-fashioned-sugar-cookies-1.jpg',
  'https://uprecipes.blog/wp-content/uploads/2025/04/best-burger-sauce-take-your-burgers-1.jpg',
  'https://uprecipes.blog/wp-content/uploads/2025/04/the-perfect-basic-burger-sometimes-simple-1.jpg',
  'https://uprecipes.blog/wp-content/uploads/2025/04/mushroom-veggie-burger-hearty-flavorful-and-1.jpg',
  'https://uprecipes.blog/wp-content/uploads/2025/04/caprese-burger-a-fresh-and-flavorful-1.jpg',
  'https://uprecipes.blog/wp-content/uploads/2025/04/the-best-burger-ever-get-ready-1.jpg',
  'https://uprecipes.blog/wp-content/uploads/2025/04/tex-mex-burger-with-cajun-mayo-spice-1.jpg',
  'https://uprecipes.blog/wp-content/uploads/2025/04/taco-bake-casserole-a-cheesy-flavorful-1.jpg',
  'https://uprecipes.blog/wp-content/uploads/2025/04/easy-taco-dip-a-quick-and-1.jpg',
  'https://uprecipes.blog/wp-content/uploads/2025/04/skillet-chicken-bulgogi-a-flavorful-korean-inspired.jpg',
  'https://uprecipes.blog/wp-content/uploads/2025/04/cinnamon-apple-cake-hanukkah-cake-a.jpg',
  'https://uprecipes.blog/wp-content/uploads/2025/04/tiramisu-a-classic-italian-dessert-with.jpg',
  'https://uprecipes.blog/wp-content/uploads/2025/04/emilys-famous-tiramisu-a-family-favorite-recipe.jpg',
  'https://uprecipes.blog/wp-content/uploads/2025/04/apple-pie-by-grandma-ople-nothing.jpg',
  'https://uprecipes.blog/wp-content/uploads/2025/04/worlds-best-lasagna-get-ready-to.jpg',
  'https://uprecipes.blog/wp-content/uploads/2025/04/round-steak-and-gravy-tender-flavorful-1.jpg'
];

const saveDirectory = 'C:\\uprecipes\\bsky_warmups\\10-04-25';

if (!fs.existsSync(saveDirectory)) {
  fs.mkdirSync(saveDirectory, { recursive: true });
}

function downloadImage(url, filepath) {
  const client = url.startsWith('https') ? https : http;

  return new Promise((resolve, reject) => {
    client.get(url, (res) => {
      if (res.statusCode === 200) {
        const file = fs.createWriteStream(filepath);
        res.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      } else {
        reject(`Failed to get '${url}' (${res.statusCode})`);
      }
    }).on('error', reject);
  });
}

(async () => {
  for (let i = 0; i < imageUrls.length; i++) {
    const filename = `${i + 1}.jpg`; // Always save as .jpg
    const filepath = path.join(saveDirectory, filename);
    try {
      console.log(`Downloading ${imageUrls[i]} to ${filepath}`);
      await downloadImage(imageUrls[i], filepath);
    } catch (err) {
      console.error(`Error downloading ${imageUrls[i]}: ${err}`);
    }
  }
})();
