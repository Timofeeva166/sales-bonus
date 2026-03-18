/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
    const { discount, sale_price, quantity } = purchase;
    const revenue = quantity * sale_price * (1 - (discount / 100));
    return revenue;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    const { profit } = seller;

    let bonesPercentage;
    if (index === 0) {
        bonesPercentage = 0.15;
    } else if (index <= 2 && index > 0) {
        bonesPercentage = 0.1;
    } else if (index >= 2 && index < total - 1) {
        bonesPercentage = 0.05;
    } else {
        bonesPercentage = 0;
    }
    return profit * bonesPercentage;
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
    if (!data
        ||!Array.isArray(data.products) || data.products.length === 0
        ||!Array.isArray(data.sellers) || data.sellers.length === 0
        ||!Array.isArray(data.purchase_records) || data.purchase_records.length === 0
    ) throw new Error ('Некорректные входные данные или не заполнены поля');
    
    const hasInvalidProducts = data.products.some(product => 
        !product.sku 
        || !product.purchase_price 
        || !product.sale_price);

    const hasInvalidSellers = data.sellers.some(seller => 
        !seller.id 
        || !seller.first_name 
        || !seller.last_name);

    const hasInvalidPurchaseRecords = data.purchase_records.some(purchase => 
        !purchase.seller_id 
        || !purchase.items 
        || !Array.isArray(purchase.items) 
        || purchase.items.length === 0 
        || !purchase.total_amount);

    const hasInvalidItems = data.purchase_records.some(purchase_record => 
        purchase_record.items.some(item => 
            !item.sku 
            || !item.discount 
            || !item.quantity 
            || !item.sale_price
        ) 
    );

    if (hasInvalidProducts || hasInvalidSellers || hasInvalidPurchaseRecords || hasInvalidItems) {
        throw new Error('Некорректные данные в структуре или не заполнены поля');
    }

    if (!options
        || typeof options !== "object"
        || typeof options.calculateRevenue !== "function"
        || typeof options.calculateBonus !== "function"
    ) throw new Error('Некорректные опции: в options должен быть передан объект с функциями');

    const { calculateRevenue, calculateBonus } = options;

    const sellerStats = data.sellers.map(seller => ({
        id: seller.id,
        name: `${seller.first_name} ${seller.last_name}`,
        revenue: 0,
        profit: 0,
        sales_count: 0,
        products_sold: {}
    }));

    const sellerIndex = Object.fromEntries(sellerStats.map(seller => [seller.id, seller]));
    const productIndex = Object.fromEntries(data.products.map(product => [product.sku, product]));

    data.purchase_records.forEach(record => {
        const seller = sellerIndex[record.seller_id];
        if (!seller) return;
        seller.sales_count += 1;
        seller.revenue += record.total_amount;

        record.items.forEach(item => {
            const product = productIndex[item.sku];
            if (!product) return;
            const cost = product.purchase_price * item.quantity;
            const revenue = calculateRevenue({
                discount: item.discount,
                sale_price: item.sale_price,
                quantity: item.quantity,
            }, product);
            const profit = revenue - cost; 
            seller.profit += profit;

            if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            seller.products_sold[item.sku] += item.quantity;
        });

        sellerStats.sort((a, b) => b.profit - a.profit);

        sellerStats.forEach((seller, index) => {
            seller.bonus = options.calculateBonus(index, sellerStats.length, seller);
            seller.top_products = Object.entries(seller.products_sold)
            .map(([sku, quantity]) => ({
                sku,
                quantity,
            }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);
        }); 
    });

    return sellerStats.map(seller => ({
        seller_id: seller.id,
        name: seller.name,
        revenue: +seller.revenue.toFixed(2),
        profit: +seller.profit.toFixed(2),
        sales_count: seller.sales_count,
        top_products: seller.top_products,
        bonus: +seller.bonus.toFixed(2)
    }));
}