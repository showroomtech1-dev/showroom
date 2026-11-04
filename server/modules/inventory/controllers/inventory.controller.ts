import { actorOf, handle, input, Paged } from "../../../shared/http/handler";
import { StockService } from "../services/stock.service";
import { StockTakeService } from "../services/stockTake.service";
import {
  adjustStockSchema,
  branchQuerySchema,
  listLevelsSchema,
  listMovementsSchema,
  listStockTakesSchema,
  recordCountsSchema,
  startStockTakeSchema,
  stockTakeIdSchema,
  stockTakeItemsSchema,
  transferStockSchema,
} from "../validators/inventory.schema";

export class InventoryController {
  static levels = handle("Stock levels fetched", async (req) =>
    Paged.of(await StockService.Instance.levels(actorOf(req), input(req, listLevelsSchema).query))
  );

  static alerts = handle("Stock alerts fetched", (req) =>
    StockService.Instance.alertCounts(actorOf(req), input(req, branchQuerySchema).query.branchId)
  );

  static movements = handle("Stock movements fetched", async (req) =>
    Paged.of(await StockService.Instance.movements(actorOf(req), input(req, listMovementsSchema).query))
  );

  static valuation = handle("Inventory valuation fetched", (req) =>
    StockService.Instance.valuation(actorOf(req), input(req, branchQuerySchema).query.branchId)
  );

  static adjust = handle("Stock adjusted", (req) => StockService.Instance.adjust(actorOf(req), input(req, adjustStockSchema).body), 201);

  static transfer = handle("Stock transferred", (req) => StockService.Instance.transfer(actorOf(req), input(req, transferStockSchema).body), 201);
}

export class StockTakeController {
  static list = handle("Stock takes fetched", async (req) =>
    Paged.of(await StockTakeService.Instance.list(actorOf(req), input(req, listStockTakesSchema).query))
  );

  static get = handle("Stock take fetched", (req) => StockTakeService.Instance.get(actorOf(req), input(req, stockTakeIdSchema).params.id));

  static items = handle("Count sheet fetched", async (req) => {
    const { params, query } = input(req, stockTakeItemsSchema);
    return Paged.of(await StockTakeService.Instance.items(actorOf(req), params.id, query));
  });

  static start = handle("Stock take started", (req) => StockTakeService.Instance.start(actorOf(req), input(req, startStockTakeSchema).body), 201);

  static recordCounts = handle("Counts saved", (req) => {
    const { params, body } = input(req, recordCountsSchema);
    return StockTakeService.Instance.recordCounts(actorOf(req), params.id, body);
  });

  static complete = handle("Stock take completed", (req) =>
    StockTakeService.Instance.complete(actorOf(req), input(req, stockTakeIdSchema).params.id)
  );

  static cancel = handle("Stock take cancelled", (req) =>
    StockTakeService.Instance.cancel(actorOf(req), input(req, stockTakeIdSchema).params.id)
  );
}
