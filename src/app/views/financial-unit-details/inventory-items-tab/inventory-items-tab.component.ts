import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FinancialUnitDetailsService } from 'src/app/services/financial-unit-details.service';
import { Observable, combineLatest, of } from 'rxjs';
import { map, startWith, tap, switchMap } from 'rxjs/operators';
import { IInventoryItemPopulated, INewInventoryItemData } from 'src/app/models/inventory-item';
import { FormControl, FormGroup } from '@angular/forms';
import { BasicTable, IBasicTableHeaderInputData, BasicTableActionItemsPosition, BasicTableValueAlign, IBasicTableRowInputData, IBasicTableInputData, BasicTableRowCellType } from 'src/app/models/basic-table-models';
import { PopUpsService } from 'src/app/services/pop-ups.service';
import { IConfirmationModalData } from 'src/app/models/confirmation-modal-data';
import { InventoryItemService } from 'src/app/services/inventory-item.service';
import { IInventoryItemFilteringCriteria } from 'src/app/models/inventory-item-filtering-criteria';
import { InventoryGroup } from 'src/app/models/inventory-group';

@Component({
  selector: 'app-inventory-items-tab',
  templateUrl: './inventory-items-tab.component.html',
  styleUrls: ['./inventory-items-tab.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InventoryItemsTabComponent {

  constructor(
    private financialUnitDetailsService: FinancialUnitDetailsService,
    private popUpsService: PopUpsService,
    private inventoryItemService: InventoryItemService
  ) { }

  isLoadingData: boolean = true;
  updateInventoryItemModalData: INewInventoryItemData = null;

  filterTextFC: FormControl = new FormControl(null);
  filterText$: Observable<string> = this.filterTextFC.valueChanges.pipe(
    startWith(this.filterTextFC.value),
    map((filterText: string) => filterText || '')
  );

  inventoryGroupOptions$: Observable<IInventoryGroupOption[]> = this.financialUnitDetailsService.InventoryGroups$.pipe(
    map((groups: InventoryGroup[]) => groups.map((group: InventoryGroup) => {
      const option: IInventoryGroupOption = {
        id: group._id,
        name: group.name
      };
      return option;
    }))
  );

  filteringCriteriaFG: FormGroup = new FormGroup({
    filterText: new FormControl(''),
    inventoryGroupId: new FormControl(0)
  });
  filteringCriteria$: Observable<IInventoryItemFilteringCriteria> = this.filteringCriteriaFG.valueChanges.pipe(
    startWith(this.filteringCriteriaFG.value)
  );

  inventoryItems$: Observable<IInventoryItemPopulated[]> = combineLatest(
    this.financialUnitDetailsService.financialUnitId$,
    this.financialUnitDetailsService.reloadInventoryItems$
  ).pipe(
    tap(() => (this.isLoadingData = true)),
    switchMap(([financialUnitId]) => financialUnitId ? this.inventoryItemService.getInventoryItems$(financialUnitId) : of([]))
  );

  filtredInventoryItems$: Observable<IInventoryItemPopulated[]> = combineLatest(
    this.inventoryItems$,
    this.filteringCriteria$
  ).pipe(
    map(([items, filteringCriteria]) => this.getFilteredInventoryItems(items, filteringCriteria))
  )

  tableData$: Observable<BasicTable> = this.filtredInventoryItems$.pipe(
    map((items: IInventoryItemPopulated[]) => this.getTableDataFromInventoryItems(items)),
    tap(() => (this.isLoadingData = false))
  );

  private getTableDataFromInventoryItems(
    items: IInventoryItemPopulated[]
  ): BasicTable {
    const header: IBasicTableHeaderInputData = {
      actionItemsPosition: BasicTableActionItemsPosition.Start,
      actionItemsContainerWidth: 2,
      otherCells: [
        {
          name: 'Název položky',
          width: 12,
          align: BasicTableValueAlign.Left
        },
        {
          name: 'Skupina',
          width: 10,
          align: BasicTableValueAlign.Left
        }
      ]
    };
    const rows: IBasicTableRowInputData[] = (items || [])
      .map(item => this.getTableRowDataFromInventoryItem(item));
    const data: IBasicTableInputData = { header, rows };
    return new BasicTable(data);
  }

  private getTableRowDataFromInventoryItem(
    item: IInventoryItemPopulated
  ): IBasicTableRowInputData {
    const row: IBasicTableRowInputData = {
      actionItems: [
        {
          iconName: 'create',
          description: 'Upravit',
          action: () => this.openNewInventoryItemModal(item)
        },
        {
          iconName: 'delete',
          description: 'Smazat',
          action: () => this.deleteItem(item)
        }
      ],
      otherCells: [
        {
          type: BasicTableRowCellType.Display,
          data: item.name
        },
        {
          type: BasicTableRowCellType.Display,
          data: item.inventoryGroup.name
        }
      ]
    }
    return row;
  }

  openNewInventoryItemModal(inventoryItem?: IInventoryItemPopulated): void {
    if (inventoryItem) {
      const data: INewInventoryItemData = {
        _id: inventoryItem._id,
        name: inventoryItem.name,
        inventoryGroupId: inventoryItem.inventoryGroup._id
      };
      this.updateInventoryItemModalData = data;
    } else {
      const data: INewInventoryItemData = { _id: null, name: null, inventoryGroupId: null };
      this.updateInventoryItemModalData = data;
    }
  }

  closeNewInventoryItemModal(): void {
    this.updateInventoryItemModalData = null;
  }

  deleteItem(item: IInventoryItemPopulated): void {
    const data: IConfirmationModalData = {
      message: 'Smazáním položky se i smažou všechny její transakce a účetní zápisy. Opravdu chcete smazat položku?',
      action: () => this.financialUnitDetailsService.deleteInventoryItem(item._id)
    };
    this.popUpsService.openConfirmationModal(data);
  }

  deleteAllItems(): void {
    const data: IConfirmationModalData = {
      message: 'Smazáním všech položek se i smažou všechny transakce a účetní zápisy. Opravdu chcete smazat všechny položky?',
      action: () => this.financialUnitDetailsService.deleteAllInventoryItems()
    };
    this.popUpsService.openConfirmationModal(data);
  }

  private getFilteredInventoryItems(
    inventoryItems: IInventoryItemPopulated[],
    filteringCriteria: IInventoryItemFilteringCriteria
  ): IInventoryItemPopulated[] {
    return inventoryItems.filter((item) => {
      if (filteringCriteria.inventoryGroupId && filteringCriteria.inventoryGroupId != item.inventoryGroup._id) {
        return false;
      }
      if (!filteringCriteria.filterText) {
        return true;
      }
      return item.name.toLowerCase().includes(filteringCriteria.filterText.toLowerCase());
    });
  }
}



interface IInventoryGroupOption {
  id: string;
  name: string;
}