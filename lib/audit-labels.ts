/** Понятные названия действий для журнала. Неизвестный код показываем как есть. */
export const ACTION_LABEL: Record<string, string> = {
  LOGIN: "Вход в систему",
  LOGIN_FAILED: "Неудачная попытка входа",
  ORDER_STATUS_CHANGED: "Смена статуса заказа", ORDER_CANCELLED: "Отмена заказа", ORDER_REFUNDED: "Возврат заказа",
  POS_ORDER_CREATED: "Продажа на кассе", WEB_ORDER_CREATED: "Заказ с сайта", PAYMENT_CONFIRMED: "Подтверждена оплата", PAYMENT_FAILED: "Оплата не прошла",
  MANUAL_DISCOUNT: "Ручная скидка", SHIFT_OPENED: "Открыта смена", SHIFT_CLOSED: "Закрыта смена",
  PRODUCT_CREATED: "Продукт создан", PRODUCT_UPDATED: "Продукт изменён", PRODUCT_PRICE_CHANGED: "Изменена цена",
  PRODUCT_ARCHIVED: "Продукт в архиве", PRODUCT_RESTORED: "Продукт восстановлен", PRODUCT_DELETED: "Продукт удалён",
  PRODUCT_AVAILABILITY: "Доступность продукта",
  CATEGORY_CREATED: "Категория создана", CATEGORY_UPDATED: "Категория изменена", CATEGORY_DELETED: "Категория удалена",
  STOCK_IN: "Приход на склад", STOCK_TRANSFER: "Перемещение между точками", INVENTORY_COUNT: "Инвентаризация", WRITEOFF_CREATED: "Списание",
  SUPPLIER_CREATED: "Поставщик добавлен", SUPPLIER_UPDATED: "Поставщик изменён", SUPPLIER_DELETED: "Поставщик удалён",
  PURCHASE_CREATED: "Закупка создана", PURCHASE_STATUS_CHANGED: "Статус закупки", PURCHASE_RECEIVED: "Закупка принята",
  CUSTOMER_CREATED: "Клиент добавлен", CUSTOMER_UPDATED: "Клиент изменён", LOYALTY_ADJUSTED: "Корректировка баллов",
  PROMO_CREATED: "Промокод создан", PROMO_TOGGLED: "Промокод вкл/выкл", PROMO_DELETED: "Промокод удалён",
  RECIPE_CHANGED: "Рецепт изменён",
  SETTINGS_CHANGED: "Изменены настройки", LOCATION_UPDATED: "Изменены адрес или телефон точки",
  TABLE_ORDER_CREATED: "Заказ гостя за столом", TABLE_BILL_CLOSED: "Закрыт счёт стола", TABLE_CREATED: "Стол добавлен", TABLE_UPDATED: "Стол включён или выключен", TABLE_TOKEN_RESET: "Перевыпущен QR стола",
  EXPENSE_CREATED: "Расход добавлен", EXPENSE_DELETED: "Расход удалён",
  EMPLOYEE_CREATED: "Сотрудник добавлен", EMPLOYEE_UPDATED: "Сотрудник изменён", EMPLOYEE_ACTIVATED: "Сотрудник включён",
  EMPLOYEE_DEACTIVATED: "Сотрудник отключён", EMPLOYEE_PASSWORD_RESET: "Смена пароля сотрудника",
};
export const actionLabel = (a: string) => ACTION_LABEL[a] ?? a;
