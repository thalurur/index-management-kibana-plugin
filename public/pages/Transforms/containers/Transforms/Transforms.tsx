/*
 * Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

import {
  Direction,
  EuiPanel,
  EuiFlexGroup,
  EuiFlexItem,
  EuiTitle,
  EuiButton,
  EuiBasicTable,
  EuiPopover,
  EuiContextMenuPanel,
  EuiFieldSearch,
  EuiHorizontalRule,
  EuiPagination,
  EuiLink,
  EuiTextColor,
  EuiTableFieldDataColumnType,
  EuiContextMenuItem,
  // @ts-ignore
  Pagination,
  EuiTableSelectionType,
  EuiTableSortingType,
} from "@elastic/eui";
import queryString from "query-string";
import { RouteComponentProps } from "react-router-dom";
import TransformService from "../../../../services/TransformService";
import {DocumentTransform} from "../../../../../models/interfaces";
import React, { Component } from "react";
import { CoreServicesContext } from "../../../../components/core_services";
import {getURLQueryParams} from "../../utils/helpers";
import {TransformQueryParams} from "../../models/interfaces";
import {getErrorMessage} from "../../../../utils/helpers";
import {ROUTES} from "../../../../utils/constants";
import DeleteModal from "../../components/DeleteModal";
import TransformEmptyPrompt from "../../components/TransformEmptyPrompt";
import {renderEnabled, renderStatus} from "../../utils/metadataHelper";
import {DEFAULT_PAGE_SIZE_OPTIONS} from "../../../Indices/utils/constants";
import _ from "lodash";

interface TransformProps extends RouteComponentProps {
  transformService: TransformService
}

interface TransformState {
  totalTransforms: number;
  from: number;
  size: number;
  search: string;
  sortField: keyof DocumentTransform;
  sortDirection: Direction;
  selectedItems: DocumentTransform[];
  transforms: DocumentTransform[];
  fetchingTransforms: boolean;
  transformMetadata: {};
  isPopOverOpen: boolean;
  isDeleteModalVisible: boolean;
}

export default class Transforms extends Component<TransformProps, TransformState> {
  static contextType = CoreServicesContext;
  constructor(props: TransformProps) {
    super(props);

    const { from, size, search, sortField, sortDirection } = getURLQueryParams(this.props.location);

    this.state = {
      totalTransforms: 0,
      from,
      size,
      search,
      sortField,
      sortDirection,
      selectedItems: [],
      transforms: [],
      fetchingTransforms: false,
      transformMetadata: {},
      isPopOverOpen: false,
      isDeleteModalVisible: false,
    };

    this.getTransforms = _.debounce(this.getTransforms, 500, { leading: true });
  };

  render() {
    const {
      totalTransforms,
      from,
      size,
      search,
      sortField,
      sortDirection,
      selectedItems,
      transforms,
      fetchingTransforms,
      isPopOverOpen,
      isDeleteModalVisible,
    } = this.state;

    const filterIsApplied = !!search;
    const pageCount = Math.ceil(totalTransforms / size) || 1;
    const page = Math.floor(from / size);
    const pagination: Pagination = {
      pageIndex: page,
      pageSize: size,
      pageSizeOptions: DEFAULT_PAGE_SIZE_OPTIONS,
      totalItemCount: totalTransforms,
    };

    const columns: EuiTableFieldDataColumnType<DocumentTransform>[] = [
      {
        field: "_id",
        name: "Name",
        sortable: true,
        textOnly: true,
        truncateText: true,
        render: (_id) => (
          <EuiLink onClick={() => this.props.history.push(`${ROUTES.TRANSFORM_DETAILS}?id=${_id}`)} data-test-subj={`transformLink_${_id}`}>
            {_id}
          </EuiLink>
        ),
      },
      {
        field: "transform.source_index",
        name: "Source index",
        sortable: true,
        textOnly: true,
        truncateText: true,
      },
      {
        field: "transform.target_index",
        name: "Target index",
        sortable: true,
        textOnly: true,
        truncateText: true,
      },
      {
        field: "transform.enabled",
        name: "Job state",
        sortable: true,
        textOnly: true,
        truncateText: true,
        render: renderEnabled,
      },
      {
        field: "metadata",
        name: "transform job status",
        sortable: false,
        textOnly: true,
        render: (metadata) => renderStatus(metadata),
      },
    ];

    const actionButton = (
      <EuiButton
        iconType="arrowDown"
        iconSide="right"
        disabled={!selectedItems.length}
        onClick={this.onActionButtonClick}
        data-test-subj="actionButton"
      >
        Actions
      </EuiButton>
    );

    const actionItems = [
      <EuiContextMenuItem
        key="Edit"
        icon="empty"
        disabled={selectedItems.length != 1}
        data-test-subj="editButton"
        onClick={() => {
          this.closePopover();
          this.onClickEdit();
        }}
      >
        Edit
      </EuiContextMenuItem>,
      <EuiContextMenuItem
        key="Delete"
        icon="empty"
        disabled={!selectedItems.length}
        data-test-subj="deleteButton"
        onClick={() => {
          this.closePopover();
          this.showDeleteModal();
        }}
      >
        <EuiTextColor color="danger">Delete</EuiTextColor>
      </EuiContextMenuItem>,
    ];

    const selection: EuiTableSelectionType<DocumentTransform> = {
      onSelectionChange: this.onSelectionChange,
    };

    const sorting: EuiTableSortingType<DocumentTransform> = {
      sort: {
        direction: sortDirection,
        field: sortField,
      },
    };


    return (
      <EuiPanel style={{ paddingLeft: "0px", paddingRight: "0px" }}>
        <EuiFlexGroup style={{ padding: "0px 10px" }} justifyContent="spaceBetween" alignItems="center">
          <EuiFlexItem>
            <EuiTitle size="m">
              <h3>{"Transform jobs (" + `${transforms.length}` + ")"}</h3>
            </EuiTitle>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiFlexGroup alignItems="center" gutterSize="s">
              <EuiFlexItem grow={false}>
                <EuiButton disabled={!selectedItems.length} onClick={this.onDisable} data-test-subj="disableButton">
                  Disable
                </EuiButton>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiButton
                  disabled={!selectedItems.length}
                  onClick={() => {
                    this.onEnable();
                  }}
                  data-test-subj="enableButton"
                >
                  Enable
                </EuiButton>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiPopover
                  id="action"
                  button={actionButton}
                  isOpen={isPopOverOpen}
                  closePopover={this.closePopover}
                  panelPaddingSize="none"
                  anchorPosition="downLeft"
                  data-test-subj="actionPopover"
                >
                  <EuiContextMenuPanel items={actionItems} />
                </EuiPopover>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiButton onClick={this.onClickCreate} fill={true} data-test-subj="createTransformButton">
                  Create transform job
                </EuiButton>
              </EuiFlexItem>
            </EuiFlexGroup>
          </EuiFlexItem>
        </EuiFlexGroup>

        <div style={{ padding: "initial" }}>
          <EuiFlexGroup style={{ padding: "0px 5px" }}>
            <EuiFlexItem>
              <EuiFieldSearch fullWidth={true} value={search} placeholder="Search" onChange={this.onSearchChange} />
            </EuiFlexItem>
            {pageCount > 1 && (
              <EuiFlexItem grow={false} style={{ justifyContent: "center" }}>
                <EuiPagination
                  pageCount={pageCount}
                  activePage={page}
                  onPageClick={this.onPageClick}
                  data-test-subj="indexControlsPagination"
                />
              </EuiFlexItem>
            )}
          </EuiFlexGroup>

          <EuiHorizontalRule margin="xs" />

          <EuiBasicTable
            columns={columns}
            isSelectable={true}
            itemId="_id"
            items={transforms}
            noItemsMessage={
              <TransformEmptyPrompt filterIsApplied={filterIsApplied} loading={fetchingTransforms} resetFilters={this.resetFilters} />
            }
            onChange={this.onTableChange}
            pagination={pagination}
            selection={selection}
            sorting={sorting}
            tableLayout="auto"
          />
          {isDeleteModalVisible && (
            <DeleteModal
              item={this.getSelectedTransformIds()}
              closeDeleteModal={this.closeDeleteModal}
              onClickDelete={this.onClickDelete}
            />
          )}
        </div>
      </EuiPanel>
    );
  }

  getTransforms = async(): Promise<void> => {
    this.setState( { fetchingTransforms: true });
    try {
      const { transformService, history } = this.props;
      const queryObject = Transforms.getQueryObjectFromState(this.state);
      const queryParamsString = queryString.stringify(Transforms.getQueryObjectFromState(this.state));
      history.replace({ ...this.props.location, search: queryParamsString });
      const response = await transformService.getTransforms(queryObject);
      if (response.ok) {
        const { transforms, totalTransforms, metadata } = response.response;
        this.setState({transforms, totalTransforms, transformMetadata: metadata});
      } else {
        this.context.notifications.toasts.addDanger(response.error);
      }
    } catch (err) {
      this.context.notifications.toasts.addDanger(getErrorMessage(err, "There was problem loading transforms"));
    }
    this.setState({ fetchingTransforms: false });
  };

  getSelectedTransformIds() { return "asd" };
  onSelectionChange() {};
  closeDeleteModal() {};
  onClickCreate() {};
  onClickDelete() {};
  onPageClick() {};
  onTableChange() {};
  onEnable() {};
  onDisable() {};
  closePopover() {};
  resetFilters() {};
  onSearchChange() {};
  onActionButtonClick() {};
  onClickEdit() {};
  showDeleteModal() {};


  static getQueryObjectFromState(transformState : TransformState) : TransformQueryParams {
    return transformState;
  }
}

