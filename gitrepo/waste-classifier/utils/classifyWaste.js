export const classifyWaste = (imageBase64) => {
  // For now, just return a mock result
  const categories = ['Organic', 'Recyclable', 'Hazardous', 'Non-recyclable'];
  const randomIndex = Math.floor(Math.random() * categories.length);
  return {
    type: 'Plastic Bottle',
    category: categories[randomIndex],
  };
};